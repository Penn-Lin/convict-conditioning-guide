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
  SessionMinutes,
  SkillSnapshot,
  TrainingState,
} from '@/types/plan';

import { MINUTE_BUDGET } from './config';
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

/** 主训是否满足「轻松完成」条件（60 分钟档的 +1 档偏移前置条件） */
function mainIsEasy(state: TrainingState, snapshot: SkillSnapshot): boolean {
  const skill = state.skills[snapshot.slug];
  const last = skill.recentSessions[0];
  if (!last) return false;
  return (
    last.completionRatio >= 1 &&
    (skill.lastFatigue ?? 3) <= 3 &&
    skill.consecutiveEasy >= 1
  );
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
    freeMinutes: ctx.minutes,
    summary: buildSummary('recovery', null, [], 0, ctx.minutes),
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
    volumeScale: options.volumeScale ?? 1,
    skills: state.skills,
    mainIsEasy: mainIsEasy(state, mainSnapshot),
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
  const freeMinutes = Math.max(
    0,
    Math.round((ctx.minutes - totalEstimatedMinutes) * 10) / 10,
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
  });

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
    freeMinutes,
    summary: buildSummary('training', mainItem, assistItems, totalEstimatedMinutes, ctx.minutes),
    tips: buildTips(items, ctx.minutes, totalEstimatedMinutes),
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
 * | 减少 / 增加训练量 | `volumeScale = 0.6 / 0.8 / 1.2` |
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
