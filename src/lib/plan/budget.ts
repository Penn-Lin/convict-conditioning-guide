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
  volumeScale: number;
  skills: Record<ArtSlug, TrainingSkill>;
  /** 主训是否满足「轻松完成」条件（决定 60 分钟档的 +1 档偏移是否生效） */
  mainIsEasy: boolean;
}

/** 该艺当前应当使用的训练量档（含软降量偏移） */
function effectiveTier(snapshot: SkillSnapshot, skills: Record<ArtSlug, TrainingSkill>): number {
  const skill = skills[snapshot.slug];
  const maxTier = Math.max(0, snapshot.ladder.length - 1);
  const base = Math.min(snapshot.volumeTier, maxTier);
  return skill.softDowngrade ? Math.max(0, base - 1) : base;
}

/** 组数缩放（`volumeScale` 只作用于组数，不轻易动单组次数） */
function scaleSets(sets: number, scale: number): number {
  return Math.max(1, Math.round(sets * scale));
}

/**
 * 组装主训练项。
 *
 * 主训可以选择「取该艺当前配得上的一档，或选择下一档更有挑战的方案」——
 * 但默认走 `volumeTier`，只有连续轻松完成后才由用户确认升档（§8.1 的难度 / 训练量分离）。
 */
export function buildMainItem(
  snapshot: SkillSnapshot,
  reason: string,
  ctx: BuildItemContext,
): PlanItem {
  const budget = MINUTE_BUDGET[ctx.minutes];
  const tierIndex = effectiveTier(snapshot, ctx.skills);
  const tier = snapshot.ladder[Math.min(tierIndex, snapshot.ladder.length - 1)];
  const offset = ctx.mainIsEasy ? budget.mainVolumeOffset : 0;

  const sets = scaleSets(tier.sets + offset, ctx.volumeScale);
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
  const tierIndex = effectiveTier(snapshot, ctx.skills);
  const tier = snapshot.ladder[Math.min(tierIndex, snapshot.ladder.length - 1)];

  const sets = scaleSets(
    Math.min(tier.sets, budget.assistSetCap),
    ctx.volumeScale,
  );
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
    restSeconds: budget.assistRestSeconds,
    estimatedMinutes: estimateMinutes(
      snapshot.slug,
      snapshot.metric,
      sets,
      tier.perSet,
      budget.assistRestSeconds,
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
