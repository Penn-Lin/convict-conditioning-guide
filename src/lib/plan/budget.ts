/**
 * 时间预算与耗时估算（设计文档 §7.4–7.6）。
 *
 * **核心立场（必须写进产品说明）**：
 * > 时间预算是「上限」和「节奏控制器」，**不是要填满的容器**。
 *
 * 按真实数据估算，45 分钟档的计划实际只占约 15 分钟。这不是 bug ——
 * 原书训练量本身就是短时段、低组数、不练到力竭（原书明确反对超量与力竭训练）。
 * 因此剩余时间显式提示用于热身 / 拉伸，并提供「加练自选池」（不自动加入）。
 */
import type { ArtSlug } from '@/types';
import type {
  ItemRole,
  PlanItem,
  SessionMinutes,
  SkillSnapshot,
  TrainingSkill,
} from '@/types/plan';
import { getMove } from '@/data';

import {
  ESTIMATE,
  ITEM_SUPPRESSION,
  MAX_ITEMS_CAP,
  MAX_SETS_PER_ITEM,
  MINUTE_BUDGET,
  OVERLAP,
  WEEK_PLAN,
} from './config';
import type { AssistCandidate } from './select';
import { formatVolume } from './volumeLadder';

/** 项数决策的完整依据（写进解释文案，让「为什么是 4 项」有据可查） */
export interface ItemCountDecision {
  /** 时间档基础项数 */
  base: number;
  /** 周计划缺口加成 */
  weekBonus: number;
  /** 疲劳抑制扣减 */
  fatigueReduce: number;
  /** 最终项数 */
  total: number;
  /** 六艺疲劳现值均值 */
  avgFatigue: number;
  /** 周缺口说明（无缺口时为 null） */
  weekNote: string | null;
}

/**
 * 决定今天排几项。
 *
 * `最终项数 = clamp(时间档 maxItems + 周缺口加成 − 疲劳抑制, 1, MAX_ITEMS_CAP)`
 *
 * 两项修正各有各的道理：
 * - **疲劳抑制**：六艺整体疲劳均值 ≥ 4.0 → 少排一项（「当天状态影响当天计划」的落地方式）；
 * - **周缺口**：本周剩余天数已不够补足训练次数缺口 → 多排一项
 *   （周一缺口大但时间充裕，不动；周六缺口大且只剩两天，加一项）。
 */
export function decideItemCount(
  minutes: SessionMinutes,
  snapshots: SkillSnapshot[],
  weekBonus: number,
  weekNote: string | null,
): ItemCountDecision {
  const base = MINUTE_BUDGET[minutes].maxItems;
  const avgFatigue =
    snapshots.length === 0
      ? 3
      : snapshots.reduce((sum, snapshot) => sum + snapshot.fatigueNow, 0) /
        snapshots.length;
  const fatigueReduce = avgFatigue >= ITEM_SUPPRESSION.highAvgFatigue
    ? ITEM_SUPPRESSION.reduceItems
    : 0;

  const total = Math.max(
    1,
    Math.min(MAX_ITEMS_CAP, base + weekBonus - fatigueReduce),
  );

  return { base, weekBonus, fatigueReduce, total, avgFatigue, weekNote };
}

/** 估算单项耗时（分钟，保留 1 位小数） */
export function estimateMinutes(
  artSlug: ArtSlug,
  metric: PlanItem['metric'],
  sets: number,
  perSet: number,
  restSeconds: number,
): number {
  const workPerSet =
    metric === 'hold' ? perSet : perSet * ESTIMATE.secondsPerRep[artSlug];
  const seconds =
    ESTIMATE.prepSeconds + workPerSet * sets + restSeconds * Math.max(0, sets - 1);
  return Math.round((seconds / 60) * 10) / 10;
}

/** 取某式的名称（数据层兜底，避免 undefined） */
function nameOf(artSlug: ArtSlug, stepNo: number): { nameZh: string; nameEn: string } {
  const move = getMove(artSlug, stepNo);
  return {
    nameZh: move?.nameZh ?? '未知动作',
    nameEn: move?.nameEn ?? '',
  };
}

/** 组装单个计划项的公共上下文 */
interface BuildItemContext {
  minutes: SessionMinutes;
  /** 组数微调（−1 / 0 / +1） */
  setsDelta: number;
  skills: Record<ArtSlug, TrainingSkill>;
  /** 今日训练量档下限（由时间档给出） */
  tierFloor: number;
  /** 用户手动指定的今日训练量档（未指定时为 `undefined`） */
  tierOverride?: number;
  /**
   * 覆盖「辅助组数上限」。
   *
   * 默认（`undefined`）走 `MINUTE_BUDGET[x].assistSetCap` —— 那是**自动调度模式**的语义：
   * 辅助的定位是「补足训练类型多样性」，不该再来一遍主训的量，所以压到 1–2 组。
   *
   * 但**原书模板模式下六门是平级科目**（「六艺全练」里没有主辅之分），
   * 压辅助的组数会让同一次训练里「主训 2 组、其余 1 组」这种不一致出现，
   * 所以模板模式传 `MAX_SETS_PER_ITEM` 把它放开。
   */
  assistSetCap?: number;
  /**
   * 覆盖「辅助组间休息秒数」。
   *
   * 同样是模板模式的平级修正：自动调度里主训休息更长（先做最难的、恢复要更充分），
   * 辅助短一些；模板模式六门平级，没有理由让同一场训练里并存两套休息标准，
   * 故传入 `MINUTE_BUDGET[x].restSeconds` 统一。
   */
  assistRestSeconds?: number;
  /**
   * **训练量档上限**（`undefined` = 不设限）。
   *
   * `effectiveTier` 的常规语义是「长期进度是地板，只允许往上」——
   * 这对自动调度是对的（原书主张稳步推进，不因为今天时间少就减量）。
   * 但**模板模式的立场相反**：六门固定，总时长必须装进时间档，装不下就得往下压。
   *
   * 没有这个上限时，「逐档下试」形同虚设：长期 `volumeTier` 一旦升到升阶档（2），
   * `max(base, tierFloor)` 恒为 2，`trial(0)` 与 `trial(1)` 产出完全相同 ——
   * 实测 **15 分钟档排出 60 分钟训练**。模板模式因此传入本次试算的档位作为上限。
   *
   * 注意优先级：用户手动指定的 `tierOverride` **不受**此上限约束（那是明确要求）。
   */
  tierCeiling?: number;
  /**
   * 今天要做**进阶测试**的科目集合。
   *
   * 命中的门直接取该式的**最高档**（= 原书「高级标准」= `progressionStandard`
   * 逗号前的数量目标），且**不受 `tierCeiling` 与 `tierFloor` 影响** ——
   * 这是用户明确要求的一次挑战，时间档与长期进度都不该拦它。
   *
   * 优先级排在「软降量」之后：上次完成度崩过的门仍然先降量，
   * 不允许用「我要测试」绕过安全阀。
   */
  challengeSkills?: ReadonlySet<ArtSlug>;
}

/**
 * 该艺今天应当使用的训练量档。
 *
 * **优先级从高到低**（这条顺序是本版修正的核心，不要调换）：
 *
 * 1. **软降量**：上次完成度崩过（< 0.60）→ 在原档基础上再降一档，
 *    且**忽略时间档下限** —— 练不动的时候，时间多不代表该加量。
 * 2. **用户手动指定**：`volumeTierOverride` 直接生效。这是「我今天想练哪一档」
 *    的落点，允许用户主动试更高档而不用等引擎批准。
 * 3. **长期进度与时间档下限取较高者**：`max(volumeTier, tierFloor)`。
 *    冷启动用户 `volumeTier = 0`（初级 1 组），若选 45 / 60 分钟档，
 *    下限会把它抬到升阶档 —— 这正是「选了 60 分钟却只练 8 分钟」的修法。
 *
 * 第 3 步额外带一层 **抬档保护**：从未练过、或最近刚失败过的项目最多只抬到中级档。
 * 依据原书第十一章「慢工出细活」——「我总是建议新手：不管你多强，都要从第一个动作开始……
 * 给自己留出至少四周的时间」。原书的路线本就是「先用初级标准起步，很快过渡到两组」，
 * 而不是一上手就按升阶标准（3 组）去冲。
 *
 * **进阶测试（`challengeSkills`）** 插在软降量之后、手动档位之前，
 * 直接返回该式最高档，且不受上限/下限约束 —— 见 `BuildItemContext.challengeSkills`。
 */
function effectiveTier(
  snapshot: SkillSnapshot,
  skills: Record<ArtSlug, TrainingSkill>,
  tierFloor: number,
  tierOverride?: number,
  tierCeiling?: number,
  challengeSkills?: ReadonlySet<ArtSlug>,
): number {
  const skill = skills[snapshot.slug];
  const maxTier = Math.max(0, snapshot.ladder.length - 1);
  const base = Math.min(snapshot.volumeTier, maxTier);

  if (skill.softDowngrade) return Math.max(0, base - 1);
  // 进阶测试：按原书高级标准（该式最高档）来一次，时间档与长期进度都让路
  if (challengeSkills?.has(snapshot.slug)) return maxTier;
  if (tierOverride !== undefined) {
    return Math.min(maxTier, Math.max(0, Math.round(tierOverride)));
  }

  // 抬档保护：没有任何训练记录、或最近刚失败过 → 时间档下限最多抬到中级档（2 组）。
  // 原书对新手的主张就是「先按初级标准起步，很快过渡到两组」，而不是一上手冲 3 组。
  const canRaise = snapshot.daysSinceLast !== null && skill.consecutiveFail === 0;
  const effectiveFloor = canRaise ? tierFloor : Math.min(tierFloor, 1);

  // 上限只在模板模式传入（见 `tierCeiling` 注释）。它必须夹在最后一步，
  // 否则「长期进度已到升阶档」会把逐档下试的结果整个吃掉。
  const ceiling = tierCeiling === undefined
    ? maxTier
    : Math.min(maxTier, Math.max(0, Math.round(tierCeiling)));

  return Math.min(ceiling, Math.max(base, effectiveFloor));
}

/**
 * 组数微调（`setsDelta` = −1 / 0 / +1）。
 *
 * **刻意用加减法而不是乘法。** 全站阶梯的组数只有 1 / 2 / 3 三种取值，
 * 早先的 `Math.round(sets × 1.2)` 对 1 组和 2 组都会圆回原值 ——
 * 用户点「增加训练量」看不出任何变化（只有 3 组的情况会变成 4 组）。
 * 加减法在小整数上必然生效，语义也更好解释：「比今天档位多一组」。
 *
 * @param sets 今天档位算出的基准组数（主训 = 档位组数；辅助 = 已受上限约束的组数）
 * @param delta 用户微调
 * @param max 该角色的组数上限（主训 4 组；辅助 = 辅助组数上限 + 1）
 */
function adjustSets(sets: number, delta: number, max: number): number {
  const base = Math.max(1, sets);
  return Math.min(Math.max(1, max), Math.max(1, base + Math.round(delta)));
}

/**
 * 组装主训练项。
 *
 * 主训取「该艺今天配得上的档」（见 `effectiveTier` 的三级优先级）。
 * 组数、单组次数都来自原书 `trainingGoal` 派生的阶梯，**引擎不改写次数**。
 */
export function buildMainItem(
  snapshot: SkillSnapshot,
  reason: string,
  ctx: BuildItemContext,
): PlanItem {
  const budget = MINUTE_BUDGET[ctx.minutes];
  const tierIndex = effectiveTier(
    snapshot,
    ctx.skills,
    ctx.tierFloor,
    ctx.tierOverride,
    ctx.tierCeiling,
    ctx.challengeSkills,
  );
  const tier = snapshot.ladder[Math.min(tierIndex, snapshot.ladder.length - 1)];

  const sets = adjustSets(tier.sets, ctx.setsDelta, MAX_SETS_PER_ITEM);
  const { nameZh, nameEn } = nameOf(snapshot.slug, snapshot.currentStep);

  return {
    skill: snapshot.slug,
    stepNo: snapshot.currentStep,
    nameZh,
    nameEn,
    role: 'main' as ItemRole,
    metric: snapshot.metric,
    volumeTier: tierIndex,
    sets,
    targetPerSet: tier.perSet,
    challenge: ctx.challengeSkills?.has(snapshot.slug) || undefined,
    restSeconds: budget.restSeconds,
    estimatedMinutes: estimateMinutes(
      snapshot.slug,
      snapshot.metric,
      sets,
      tier.perSet,
      budget.restSeconds,
    ),
    reason,
  };
}

/**
 * 组装辅助训练项。
 *
 * 辅助组数受 `assistSetCap` 限制（15 分钟档只有 1 组），
 * 因为辅助的定位是「补足训练类型多样性」，不是「再来一遍主训的量」。
 */
export function buildAssistItem(
  candidate: AssistCandidate,
  reason: string,
  ctx: BuildItemContext,
  role: ItemRole = 'assist',
): PlanItem {
  const budget = MINUTE_BUDGET[ctx.minutes];
  const { snapshot } = candidate;
  const isChallenge = ctx.challengeSkills?.has(snapshot.slug) ?? false;
  const tierIndex = effectiveTier(
    snapshot,
    ctx.skills,
    ctx.tierFloor,
    ctx.tierOverride,
    ctx.tierCeiling,
    ctx.challengeSkills,
  );
  const tier = snapshot.ladder[Math.min(tierIndex, snapshot.ladder.length - 1)];

  // 辅助仍先受「辅助组数上限」约束（15 分钟档 1 组、其余 2 组，模板模式可被放开），
  // 再套用用户微调 —— 微调时允许比常规上限多 1 组（用户明确要求加量）。
  // **进阶测试项豁免这个上限**：它要做的正是「原书高级标准」那个量，
  // 被压到 1–2 组就不是测试了。
  const cap = isChallenge ? MAX_SETS_PER_ITEM : (ctx.assistSetCap ?? budget.assistSetCap);
  const sets = adjustSets(
    Math.min(tier.sets, cap),
    ctx.setsDelta,
    cap + 1,
  );
  const restSeconds = ctx.assistRestSeconds ?? budget.assistRestSeconds;
  const { nameZh, nameEn } = nameOf(snapshot.slug, snapshot.currentStep);

  return {
    skill: snapshot.slug,
    stepNo: snapshot.currentStep,
    nameZh,
    nameEn,
    role,
    metric: snapshot.metric,
    volumeTier: tierIndex,
    sets,
    targetPerSet: tier.perSet,
    challenge: isChallenge || undefined,
    restSeconds,
    estimatedMinutes: estimateMinutes(
      snapshot.slug,
      snapshot.metric,
      sets,
      tier.perSet,
      restSeconds,
    ),
    reason,
  };
}

/**
 * 组装加练自选池（§7.6）。
 *
 * 只放「互补性合格但今天没被选中」的项目，**不自动加入**，由用户点选。
 * 若用户连续选择加练，说明其实际承受能力高于原书低阶标准 ——
 * `volumeTier` 的晋级会更快（连续轻松完成 → 档位提升），系统会自己长大，
 * 而不需要一开始就把 45 分钟排满。
 */
export function buildOptionalPool(
  candidates: AssistCandidate[],
  selectedSkills: ArtSlug[],
  mainSkill: ArtSlug,
  ctx: BuildItemContext,
): PlanItem[] {
  if (!MINUTE_BUDGET[ctx.minutes].optionalPool) return [];

  const picked: AssistCandidate[] = [];
  for (const candidate of candidates) {
    if (picked.length >= ESTIMATE.optionalPoolSize) break;
    if (candidate.snapshot.slug === mainSkill) continue;
    if (selectedSkills.includes(candidate.snapshot.slug)) continue;
    if (candidate.overlapWithMain > OVERLAP.maxWithMain) continue;
    picked.push(candidate);
  }

  return picked.map((candidate) => {
    const item = buildAssistItem(candidate, '', ctx, 'optional');
    return {
      ...item,
      reason: `可选加练：与主训练互补，强度可控（${formatVolume(
        item.metric,
        item.sets,
        item.targetPerSet,
      )}）。时间有富余时再考虑，不做也没关系。`,
    };
  });
}

/** 计算「周计划缺口加成」（§ config.WEEK_PLAN 决策记录） */
export function computeWeekBonus(input: {
  enabled: boolean;
  daysPerWeek: number;
  today: string;
  weekCompleted: number;
  daysLeftInWeek: number;
}): { bonus: number; note: string | null } {
  if (!WEEK_PLAN.enabled || !input.enabled) return { bonus: 0, note: null };

  const remainingNeeded = Math.max(0, input.daysPerWeek - input.weekCompleted);
  if (remainingNeeded <= input.daysLeftInWeek) return { bonus: 0, note: null };

  return {
    bonus: WEEK_PLAN.bonusItems,
    note: `本周计划 ${input.daysPerWeek} 次，已完成 ${input.weekCompleted} 次，剩余 ${input.daysLeftInWeek} 天已练不完缺口，因此今天多排 ${WEEK_PLAN.bonusItems} 项。`,
  };
}

/** 合计耗时（分钟，保留 1 位） */
export function sumMinutes(items: PlanItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.estimatedMinutes, 0) * 10) / 10;
}
