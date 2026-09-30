/**
 * 动态训练计划生成引擎 —— 唯一入口（设计文档 §4.1 / §9.1）。
 *
 * **三条不可动摇的设计原则**（设计文档 §1.3）：
 *
 * 1. **完全确定性，零随机**。「换一个方案」= 排除当前主训后重算，而不是掷骰子；
 *    同分时用原书顺序做 tie-break。好处：结果可复现、可单测、可解释。
 * 2. **唯一生成入口**。首次生成、排除某艺、换方案、加减量、限定时长，
 *    全部调用同一个 `generateDailyPlan`，差异都收敛到 `options`。不存在第二条生成路径。
 * 3. **引擎不写状态**。引擎只产出「建议」，所有对持久化状态的修改
 *    （训练量档提升、Step 晋级、降阶）都由 UI 上用户点击确认后写入 hooks。
 *
 * 本模块**绝不** import React、**绝不**读 localStorage、**绝不**取系统时间。
 * 因此它可以在 Node 里直接跑单测。
 */
import type { ArtSlug } from '@/types';
import type {
  DailyPlan,
  ExclusionCode,
  ExclusionRecord,
  PlanItem,
  PlanOptions,
  PriorityBreakdown,
  ScheduleMode,
  SessionMinutes,
  SkillSnapshot,
  TrainingState,
} from '@/types/plan';
import { getArt } from '@/data';

import {
  MAX_SETS_PER_ITEM,
  MINUTE_BUDGET,
  ESTIMATE,
  OVERLAP_MATRIX,
  TEXTBOOK_TIER_CANDIDATES,
  TIER_FIT_SLACK_MINUTES,
  tierLabel,
} from './config';
import {
  buildAssistItem,
  buildMainItem,
  buildOptionalPool,
  computeWeekBonus,
  decideItemCount,
  sumMinutes,
} from './budget';
import { applyGate } from './gate';
import { buildReasons, buildSummary, buildTips, assistReason, mainReason } from './explain';
import { primaryArtOf, rankSnapshots, scoreAll } from './priority';
import type { AssistCandidate } from './select';
import { scoreAssists, selectAssists } from './select';
import { buildSnapshots } from './snapshot';
import { isTextbookMode, resolveTemplate, textbookPlanOf } from './template';
import type { TextbookSlug } from './config';
import { daysLeftInWeek, makeId, weekStart } from './time';

/** 引擎上下文（一次生成过程中反复用到的公共值） */
interface PlanContext {
  today: string;
  minutes: SessionMinutes;
  revision: number;
  options: PlanOptions;
}

/** 解析生效的时间档（用户当天选择优先于档案默认值） */
function resolveMinutes(state: TrainingState, options: PlanOptions): SessionMinutes {
  return options.availableMinutes ?? state.profile.onboarding.sessionMinutes;
}

/**
 * 解析生效的排期模式。
 *
 * 优先级：当天临时指定 > 档案里的长期偏好 > `auto`。
 *
 * **默认 `auto` 是刻意的**：v4 之前的老存档没有这个字段，默认成模板会让
 * 用户某天打开发现计划完全变了却不知道为什么。想用原书模板要在「调整」里主动切一次。
 */
export function resolveScheduleMode(state: TrainingState, options: PlanOptions): ScheduleMode {
  return options.scheduleMode ?? state.profile.onboarding.scheduleMode ?? 'auto';
}

/**
 * 时间账：热身 / 训练 / 放松 / 真正富余。
 *
 * 把热身与放松**显式计入**，是修掉「剩余 52 分钟建议用于热身」这种结论的关键 ——
 * 原书的热身只有 2 组、两三分钟，不可能吃掉半小时。
 */
function timeLedger(minutes: number, trainMinutes: number) {
  const warmupMinutes = ESTIMATE.warmupMinutes;
  const cooldownMinutes = ESTIMATE.cooldownMinutes;
  const freeMinutes = Math.max(
    0,
    Math.round((minutes - warmupMinutes - trainMinutes - cooldownMinutes) * 10) / 10,
  );
  return { warmupMinutes, cooldownMinutes, freeMinutes };
}

/**
 * 今日训练量档的说明文案（当时间档把档位抬高了、或用户手动指定时生成）。
 *
 * 这是「为什么今天练的是升阶档而不是初级档」的唯一解释入口，
 * 避免用户以为系统在偷偷加量。
 */
function tierNote(
  state: TrainingState,
  minutes: SessionMinutes,
  options: PlanOptions,
  items: PlanItem[],
): string | null {
  if (items.length === 0) return null;
  const floor = MINUTE_BUDGET[minutes].tierFloor;

  if (options.volumeTierOverride !== undefined) {
    return `已按你的指定，今天所有项目都按${tierLabel(options.volumeTierOverride)}安排（只作用于今天，不影响长期进度）。`;
  }

  const raised = items.filter((item) => {
    const skill = state.skills[item.skill];
    return item.volumeTier > skill.volumeTier;
  });
  if (raised.length === 0) return null;

  const names = (list: PlanItem[]) =>
    list
      .map((item) => getArt(item.skill)?.nameZh ?? item.skill)
      .join('、');

  // 分两类说：本来就有训练记录、被时间档抬档的；以及从没练过、按原书默认量起步的
  const seasoned = raised.filter((item) => state.skills[item.skill].recentSessions.length > 0);
  const fresh = raised.filter((item) => state.skills[item.skill].recentSessions.length === 0);

  const parts: string[] = [];
  if (seasoned.length > 0) {
    parts.push(
      `你的时间档是 ${minutes} 分钟，${names(seasoned)}按${tierLabel(
        Math.max(...seasoned.map((item) => item.volumeTier)),
      )}安排（不低于时间档底线${tierLabel(floor)}）`,
    );
  }
  if (fresh.length > 0) {
    parts.push(`${names(fresh)}还没有训练记录，本次按${tierLabel(1)}（2 组）起步`);
  }

  return `${parts.join('；')}。原书说「我通常建议练习两组」，初级档只是刚换新一式时的门槛。`;
}

/**
 * 本周（周一开始）已完成的训练次数。
 *
 * 只统计 `state === 'done'` 的会话，且按**日期去重** ——
 * 同一天练两门艺算 1 次训练，不刷分。
 */
export function weekCompletedCount(state: TrainingState, today: string): number {
  const start = weekStart(today);
  const dates = new Set<string>();
  for (const session of state.sessions) {
    if (session.state !== 'done') continue;
    if (session.date >= start && session.date <= today) dates.add(session.date);
  }
  return dates.size;
}

/** 恢复日兜底方案（§4.3）：绝不返回空白页 */
function buildRecoveryPlan(
  ctx: PlanContext,
  excluded: ExclusionRecord[],
  scores: Record<ArtSlug, PriorityBreakdown>,
  countDecision: ReturnType<typeof decideItemCount>,
  returned: { skill: ArtSlug; code: ExclusionCode; text: string }[],
): DailyPlan {
  const reasons = buildReasons({
    main: null,
    assists: [],
    unselected: [],
    scores,
    excluded,
    options: ctx.options,
    minutes: ctx.minutes,
    totalEstimatedMinutes: 0,
    countDecision,
    returned,
    kind: 'recovery',
  });

  return {
    id: makeId('plan', ctx.today, ctx.revision),
    date: ctx.today,
    generatedAt: `${ctx.today}T12:00:00`,
    revision: ctx.revision,
    availableMinutes: ctx.minutes,
    kind: 'recovery',
    main: null,
    assists: [],
    optional: [],
    totalEstimatedMinutes: 0,
    warmupMinutes: 0,
    cooldownMinutes: 0,
    freeMinutes: ctx.minutes,
    summary: buildSummary('recovery', null, [], 0, ctx.minutes, {
      warmupMinutes: 0,
      cooldownMinutes: 0,
      freeMinutes: ctx.minutes,
    }),
    tips: [
      '今天不安排训练。恢复也是训练的一部分 —— 原书明确反对连续超量。',
      '建议做 10 分钟轻度活动（散步 / 拉伸 / 呼吸练习），保持关节活动度即可。',
      '若仍想练点什么，可在下方「重置今天的调整」清空排除项后重新生成。',
    ],
    reasons,
    excluded,
    scores,
    appliedOptions: { ...ctx.options, today: ctx.today },
  };
}

/**
 * 原书模板模式：生成今日计划。
 *
 * ## 与 `auto` 模式的分工
 * 本函数**只替换「今天练哪几门」这一层**。科目清单交给模板，主训取其中优先级最高的那门；
 * 其余的「定档位 → 组数 → 单组次数 → 组间休息 → 时间账 → 解释」全部复用同一套实现。
 *
 * ## 为什么不像 auto 那样走硬门控
 * `auto` 模式里门控是**排除**（今天练过 / 太累 / 停滞 → 这一门不排）。
 * 模板模式下科目是固定的，排除任何一门都会让「六艺全练」缺一角，那就不是原书的计划了。
 * 所以这里把门控**降级**为两条更温和的表达：
 * - 「距上次训练不足 `TEXTBOOK_REST_DAYS` 天」→ 该门今天不排（`resolveTemplate` 负责）；
 * - 上次完成度崩过（`softDowngrade`）→ 由 `effectiveTier` 自动再降一档。
 *
 * ## 档位怎么定
 * 从 `TEXTBOOK_TIER_CANDIDATES`（中级档 → 初级档）**逐档下试**，
 * 取第一个「热身 + 训练 + 放松」装得进时间档（含 `TIER_FIT_SLACK_MINUTES` 容差）的档位。
 * 原书的日常训练量就是「通常建议练习两组」，所以中级档是首选；时间不够才退到 1 组。
 */
function buildTextbookDailyPlan(input: {
  ctx: PlanContext;
  state: TrainingState;
  mode: TextbookSlug;
  snapshots: SkillSnapshot[];
  scores: Record<ArtSlug, PriorityBreakdown>;
  ranked: SkillSnapshot[];
}): DailyPlan {
  const { ctx, state, mode, snapshots, scores, ranked } = input;
  const options = ctx.options;
  const planDef = textbookPlanOf(mode)!;

  const selection = resolveTemplate(mode, snapshots, options.excludeSkills ?? []);

  // 科目按优先级排序：主训 = 今天科目里优先级最高的那门（「体力最好时做最难的」）
  const selected = ranked.filter((snapshot) => selection.arts.includes(snapshot.slug));
  const mainSnapshot = selected[0];

  // 兜底：科目全被排除（理论上不会，模板是固定清单）→ 走恢复日，绝不返回空白页
  if (!mainSnapshot) {
    return buildRecoveryPlan(
      ctx,
      [],
      scores,
      {
        base: selection.arts.length,
        weekBonus: 0,
        fatigueReduce: 0,
        total: selection.arts.length,
        avgFatigue: 0,
        weekNote: null,
      },
      [],
    );
  }

  // 其余科目按优先级降序当「辅助」。这里不用 `selectAssists` 的硬约束：
  // 原书的六艺清单本身就是设计好的组合，不该被「负荷重叠」二次筛掉。
  const assistCandidates: AssistCandidate[] = selected.slice(1).map((snapshot) => ({
    snapshot,
    value: scores[snapshot.slug].total,
    parts: { score: 0, complement: 0, freshness: 0 },
    overlapWithMain: OVERLAP_MATRIX[mainSnapshot.slug][snapshot.slug],
  }));

  /** 按给定档位下限组装全部计划项 */
  const trial = (tierFloor: number) => {
    const buildCtx = {
      minutes: ctx.minutes,
      setsDelta: options.setsDelta ?? 0,
      skills: state.skills,
      tierFloor,
      tierOverride: options.volumeTierOverride,
      // 模板模式下六门是平级科目，不受「辅助组数上限」压制（见 BuildItemContext 注释）
      assistSetCap: MAX_SETS_PER_ITEM,
    };
    const main = buildMainItem(mainSnapshot, mainReason(mainSnapshot), buildCtx);
    const assists = assistCandidates.map((candidate) =>
      buildAssistItem(
        candidate,
        assistReason(candidate, mainSnapshot.slug, mainSnapshot.currentStep),
        buildCtx,
      ),
    );
    return { main, assists, total: sumMinutes([main, ...assists]) };
  };

  // 逐档下试：取第一个装得进时间档（含容差）的档位；都装不下则用最低档。
  // 兜底路径（昨天刚练过）**只允许最低档** —— 文案承诺了「统一降到初级档」，代码必须真的做到。
  const candidates = selection.allResting
    ? [TEXTBOOK_TIER_CANDIDATES[TEXTBOOK_TIER_CANDIDATES.length - 1]]
    : TEXTBOOK_TIER_CANDIDATES;
  const budget = ctx.minutes + TIER_FIT_SLACK_MINUTES;
  let chosenFloor = candidates[candidates.length - 1];
  let built = trial(chosenFloor);
  for (const floor of candidates) {
    const attempt = trial(floor);
    const elapsed = ESTIMATE.warmupMinutes + attempt.total + ESTIMATE.cooldownMinutes;
    if (elapsed <= budget) {
      chosenFloor = floor;
      built = attempt;
      break;
    }
  }

  const items: PlanItem[] = [built.main, ...built.assists];
  const totalEstimatedMinutes = built.total;
  const { warmupMinutes, cooldownMinutes, freeMinutes } = timeLedger(
    ctx.minutes,
    totalEstimatedMinutes,
  );

  // 未排进今天、也不是「休息中」的科目（初试身手不含桥与倒立撑，那两门会落在这里）
  const outsideTemplate = ranked.filter((snapshot) => !selection.arts.includes(snapshot.slug));

  const countDecision = {
    base: selection.arts.length,
    weekBonus: 0,
    fatigueReduce: 0,
    total: items.length,
    avgFatigue:
      snapshots.reduce((sum, snapshot) => sum + snapshot.fatigueNow, 0) /
      Math.max(1, snapshots.length),
    weekNote: null,
  };

  const reasons = buildReasons({
    main: { snapshot: mainSnapshot, item: built.main },
    assists: assistCandidates.map((candidate, index) => ({
      candidate,
      item: built.assists[index],
    })),
    unselected: outsideTemplate,
    scores,
    excluded: [],
    options,
    minutes: ctx.minutes,
    totalEstimatedMinutes,
    countDecision,
    returned: [],
    kind: 'training',
    tierNote: null,
    schedule: {
      mode,
      name: planDef.name,
      tagline: planDef.tagline,
      daysPerWeek: planDef.daysPerWeek,
      source: planDef.source,
      tier: chosenFloor,
      resting: selection.resting.map((slug) => getArt(slug)?.nameZh ?? slug),
      allResting: selection.allResting,
    },
  });

  const ledger = { warmupMinutes, cooldownMinutes, freeMinutes };

  return {
    id: makeId('plan', ctx.today, ctx.revision),
    date: ctx.today,
    generatedAt: `${ctx.today}T12:00:00`,
    revision: ctx.revision,
    availableMinutes: ctx.minutes,
    kind: 'training',
    main: built.main,
    assists: built.assists,
    optional: [], // 模板模式不提供加练自选：科目已由原书清单定满
    totalEstimatedMinutes,
    ...ledger,
    summary: buildSummary(
      'training',
      built.main,
      built.assists,
      totalEstimatedMinutes,
      ctx.minutes,
      ledger,
    ),
    tips: buildTips(items, ctx.minutes, totalEstimatedMinutes, ledger),
    reasons,
    excluded: [],
    scores,
    appliedOptions: { ...options, today: ctx.today },
  };
}

/**
 * 生成今日训练计划。
 *
 * @param state   当前训练状态（由 hooks 组装）
 * @param options 用户当天调整（唯一变体入口）
 * @param revision 重算次数（从 0 开始）
 */
export function generateDailyPlan(
  state: TrainingState,
  options: PlanOptions = {},
  revision = 0,
): DailyPlan {
  const today = options.today ?? state.today;
  const ctx: PlanContext = {
    today,
    minutes: resolveMinutes(state, options),
    revision,
    options,
  };

  // ① 派生计算态
  const snapshots = buildSnapshots({ ...state, today });

  // ② 排期模式分叉 —— **本版唯一的分叉点**，只决定「今天练哪几门」
  const mode = resolveScheduleMode(state, options);
  if (isTextbookMode(mode)) {
    const primaryArt = primaryArtOf(snapshots);
    const textbookScores = scoreAll(snapshots, primaryArt);
    const textbookRanked = rankSnapshots(snapshots, textbookScores);
    textbookRanked.forEach((snapshot, index) => {
      textbookScores[snapshot.slug].rank = index + 1;
    });
    return buildTextbookDailyPlan({
      ctx,
      state,
      mode,
      snapshots,
      scores: textbookScores,
      ranked: textbookRanked,
    });
  }

  // ② 周计划缺口（只作用于项数，不参与打分 —— 见 config.WEEK_PLAN 决策记录）
  const weekResult = computeWeekBonus({
    enabled: true,
    daysPerWeek: state.profile.onboarding.daysPerWeek,
    today,
    weekCompleted: weekCompletedCount(state, today),
    daysLeftInWeek: daysLeftInWeek(today),
  });

  // ③ 硬门控
  const gate = applyGate(snapshots, state.skills, { ...options, today });

  // ④ 打分与排名（即使走了恢复日路径也要算，UI 的「为什么是它」面板需要）
  const primaryArt = primaryArtOf(snapshots);
  const scores = scoreAll(snapshots, primaryArt);
  const ranked = rankSnapshots(snapshots, scores);
  ranked.forEach((snapshot, index) => {
    scores[snapshot.slug].rank = index + 1;
  });

  const countDecision = decideItemCount(
    ctx.minutes,
    snapshots,
    weekResult.bonus,
    weekResult.note,
  );

  // ⑤ 候选池为空 → 恢复日兜底，绝不返回空计划
  if (gate.pool.length === 0) {
    return buildRecoveryPlan(
      ctx,
      gate.excluded,
      scores,
      countDecision,
      gate.returned,
    );
  }

  // ⑥ 主训练 = 候选池内优先级第一
  const rankedPool = ranked.filter((snapshot) =>
    gate.pool.some((item) => item.slug === snapshot.slug),
  );
  const mainSnapshot = rankedPool[0];

  // ⑦ 辅助训练：互补性 + 类型分散
  const assistCandidates = scoreAssists(mainSnapshot.slug, rankedPool, scores);
  const assistCount = Math.max(0, countDecision.total - 1);
  const chosenAssists = selectAssists(assistCandidates, assistCount);

  // ⑧ 组装计划项
  const buildCtx = {
    minutes: ctx.minutes,
    setsDelta: options.setsDelta ?? 0,
    skills: state.skills,
    tierFloor: MINUTE_BUDGET[ctx.minutes].tierFloor,
    tierOverride: options.volumeTierOverride,
  };

  const mainItem = buildMainItem(
    mainSnapshot,
    mainReason(mainSnapshot),
    buildCtx,
  );
  const assistItems = chosenAssists.map((candidate) =>
    buildAssistItem(
      candidate,
      assistReason(candidate, mainSnapshot.slug, mainSnapshot.currentStep),
      buildCtx,
    ),
  );

  const selectedSkills: ArtSlug[] = [
    mainSnapshot.slug,
    ...chosenAssists.map((candidate) => candidate.snapshot.slug),
  ];

  const optionalItems =
    MINUTE_BUDGET[ctx.minutes].optionalPool && gate.pool.length > selectedSkills.length
      ? buildOptionalPool(assistCandidates, selectedSkills, mainSnapshot.slug, buildCtx)
      : [];

  const items: PlanItem[] = [mainItem, ...assistItems];
  const totalEstimatedMinutes = sumMinutes(items);
  const { warmupMinutes, cooldownMinutes, freeMinutes } = timeLedger(
    ctx.minutes,
    totalEstimatedMinutes,
  );

  // ⑨ 生成解释
  const unselected = rankedPool.filter(
    (snapshot) => !selectedSkills.includes(snapshot.slug),
  );

  const reasons = buildReasons({
    main: { snapshot: mainSnapshot, item: mainItem },
    assists: chosenAssists.map((candidate, index) => ({
      candidate,
      item: assistItems[index],
    })),
    unselected,
    scores,
    excluded: gate.excluded,
    options: options,
    minutes: ctx.minutes,
    totalEstimatedMinutes,
    countDecision,
    returned: gate.returned,
    kind: 'training',
    tierNote: tierNote(state, ctx.minutes, options, items),
  });

  const ledger = { warmupMinutes, cooldownMinutes, freeMinutes };

  return {
    id: makeId('plan', today, revision),
    date: today,
    generatedAt: `${today}T12:00:00`,
    revision,
    availableMinutes: ctx.minutes,
    kind: 'training',
    main: mainItem,
    assists: assistItems,
    optional: optionalItems,
    totalEstimatedMinutes,
    ...ledger,
    summary: buildSummary(
      'training',
      mainItem,
      assistItems,
      totalEstimatedMinutes,
      ctx.minutes,
      ledger,
    ),
    tips: buildTips(items, ctx.minutes, totalEstimatedMinutes, ledger),
    reasons,
    excluded: gate.excluded,
    scores,
    appliedOptions: { ...options, today },
  };
}

/**
 * 用户主动修改计划后的重新计算（§9）。
 *
 * 所有修改都转成 `PlanOptions` 后走同一个生成入口，并 `revision + 1`。
 *
 * | 用户操作 | Options 变化 |
 * |---|---|
 * | 今天不想练 X | `excludeSkills = [...prev, X]` |
 * | 换一个方案 | `avoidMain = 当前 main`（内部转为 excludeSkills） |
 * | 减少 / 增加训练量 | `setsDelta = -1 / 1`（每项组数 ±1） |
 * | 今天只想练某类 | `onlySkills = [...]` |
 * | 改时间 | `availableMinutes = 15` |
 *
 * 保证：**确定性**（同 state + 同 options 必同结果）、**可撤销**（清空 appliedOptions 重算）、
 * **不污染长期状态**（当天的排除只作用于当天）。
 */
export function replan(
  state: TrainingState,
  current: DailyPlan,
  patch: Partial<PlanOptions>,
): DailyPlan {
  const next: PlanOptions = { ...current.appliedOptions, ...patch, today: current.date };

  if (patch.avoidMain) {
    const excludes = new Set(next.excludeSkills ?? []);
    excludes.add(patch.avoidMain);
    next.excludeSkills = [...excludes];
    delete next.avoidMain;
  }

  return generateDailyPlan(state, next, current.revision + 1);
}

/** 重置当天全部调整（撤销到初始计划） */
export function resetPlan(
  state: TrainingState,
  current: DailyPlan,
  baseOptions: PlanOptions = {},
): DailyPlan {
  return generateDailyPlan(
    state,
    { ...baseOptions, today: current.date },
    current.revision + 1,
  );
}

/** 供 UI 判断「今天是否已有可用计划」 */
export function isSameDay(plan: DailyPlan | null, today: string): boolean {
  return plan !== null && plan.date === today;
}

export type { AssistCandidate };
