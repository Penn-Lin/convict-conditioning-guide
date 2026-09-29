/**
 * 六艺状态快照（设计文档 §3）。
 *
 * `TrainingSkill` 是**存储态**（只记事实：何时练、练了多少、什么感觉），
 * `SkillSnapshot` 是**计算态**（含时间衰减、重叠、晋级就绪判断）。
 *
 * 分开的理由：计算态可以随配置变化随时重算，而不必改写历史数据 ——
 * 调一次 `FATIGUE.decayPerDay`，所有历史疲劳的现值立刻按新规则重算。
 */
import type { ArtSlug } from '@/types';
import type {
  MetricKind,
  SessionSummary,
  SkillSnapshot,
  SkillStatus,
  TrainingSkill,
  TrainingState,
  VolumeTier,
} from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';
import { getMove } from '@/data';

import {
  COMPLETION,
  FATIGUE,
  OVERLAP,
  OVERLAP_MATRIX,
  PROGRESSION_DEFAULT,
  STEP_ADJUSTMENTS,
} from './config';
import { daysBetween, hoursBetween } from './time';
import { inferTier, parseVolumeLadder } from './volumeLadder';

/** 该式不存在时的兜底阶梯（保证引擎永不断链） */
const FALLBACK_LADDER: VolumeTier[] = [{ sets: 2, perSet: 8 }];

/**
 * 计算基准时刻。
 *
 * 引擎不读系统时间：`state.now` 由调用方给出（真实运行时 = 当前时刻）；
 * 未给出时退化为「今天中午 12:00」—— 这样按「天」记录的模拟数据
 * 能得到整数倍的 24 小时，单测结果完全可复现。
 */
export function referenceInstant(state: TrainingState): string {
  return state.now ?? `${state.today}T12:00:00`;
}

/** 取某式（随步数偏移）的训练量阶梯；越界时钳到 1–10 */
export function ladderFor(artSlug: ArtSlug, stepNo: number): VolumeTier[] {
  const clamped = Math.min(10, Math.max(1, stepNo));
  const move = getMove(artSlug, clamped);
  if (!move) return FALLBACK_LADDER;
  const { ladder } = parseVolumeLadder(move.trainingGoal);
  return ladder.length > 0 ? ladder : FALLBACK_LADDER;
}

/** 取某式的计量方式（次数型 / 保持型） */
export function metricFor(artSlug: ArtSlug, stepNo: number): MetricKind {
  const clamped = Math.min(10, Math.max(1, stepNo));
  const move = getMove(artSlug, clamped);
  if (!move) return 'reps';
  return parseVolumeLadder(move.trainingGoal).metric;
}

/**
 * 最近 N 次训练的**加权平均完成度**（权重 N, N−1, …, 1，按可用记录归一化）。
 *
 * 越近的记录权重越高 —— 上周的状态好不能抵消昨天的崩盘。
 * 无任何记录时返回 `COMPLETION.noHistoryDefault`（中性，既不奖励也不惩罚没练过的项目）。
 *
 * @param sessions 该艺的训练摘要，**最新在前**
 */
export function weightedCompletion(sessions: SessionSummary[]): number {
  const used = sessions.slice(0, COMPLETION.window);
  if (used.length === 0) return COMPLETION.noHistoryDefault;

  let weighted = 0;
  let weightSum = 0;
  used.forEach((session, index) => {
    const weight = COMPLETION.window - index;
    weighted += session.completionRatio * weight;
    weightSum += weight;
  });

  return weightSum === 0 ? COMPLETION.noHistoryDefault : weighted / weightSum;
}

/**
 * 疲劳现值（带日衰减）。
 *
 * `decayed = NEUTRAL + (lastFatigue − NEUTRAL) × DECAY^daysSince`
 *
 * 没有这一步，「上周很累」会一直罚到今天。
 */
export function fatigueNowOf(
  daysSince: number | null,
  lastFatigue: number | null,
): number {
  if (daysSince === null || lastFatigue === null) return FATIGUE.neutral;
  return (
    FATIGUE.neutral +
    (lastFatigue - FATIGUE.neutral) * FATIGUE.decayPerDay ** Math.max(0, daysSince)
  );
}

/** 状态判定（§3.1） */
export function deriveStatus(skill: TrainingSkill): SkillStatus {
  if (skill.currentStep > 10) return 'mastered';
  if (skill.recentSessions.length === 0) return 'not_started';
  if (skill.consecutiveFail >= PROGRESSION_DEFAULT.stall.sessions) return 'stalled';
  return 'active';
}

/** 与「最近 48 小时内练过的艺」的最大重叠度（含自己 —— `[s][s] = 1.0`） */
export function overlapWithRecent(slug: ArtSlug, recentSkills: ArtSlug[]): number {
  if (recentSkills.length === 0) return 0;
  return Math.max(...recentSkills.map((recent) => OVERLAP_MATRIX[recent][slug]));
}

/** 按当前 Step 取生效的保守化规则（§8.3） */
export function effectiveRules(stepNo: number) {
  const isHighStep = stepNo >= STEP_ADJUSTMENTS.highStepFrom;
  return {
    promote: isHighStep
      ? { ...PROGRESSION_DEFAULT.promote, ...STEP_ADJUSTMENTS.promote }
      : PROGRESSION_DEFAULT.promote,
    stall: isHighStep
      ? { ...PROGRESSION_DEFAULT.stall, ...STEP_ADJUSTMENTS.stall }
      : PROGRESSION_DEFAULT.stall,
    isHighStep,
  };
}

/**
 * 晋级是否就绪（§8.5）。
 *
 * 三个必要条件缺一不可：训练量已爬满最高档、最近 N 次都达标、疲劳可控。
 * **只产生「建议」，绝不自动改 `currentStep`** —— 需求里「不要每次训练都自动升级」由此保证。
 */
export function isProgressionReady(
  skill: TrainingSkill,
  ladder: VolumeTier[],
): boolean {
  const rules = effectiveRules(skill.currentStep).promote;
  const maxTier = ladder.length - 1;
  if (skill.volumeTier < maxTier) return false;

  const recent = skill.recentSessions.slice(0, rules.minSessions);
  if (recent.length < rules.minSessions) return false;

  const allOk = recent.every(
    (session) =>
      session.completionRatio >= rules.minRatio - rules.nearMissTolerance &&
      session.volumeTier === maxTier,
  );
  const fatigueOk =
    recent.reduce((sum, session) => sum + (session.fatigue ?? FATIGUE.neutral), 0) /
      recent.length <=
    rules.maxAvgFatigue;

  return allOk && fatigueOk;
}

/** 由 `state` 派生单个艺的快照 */
export function buildSnapshot(
  slug: ArtSlug,
  state: TrainingState,
  recentSkills: ArtSlug[],
): SkillSnapshot {
  const skill = state.skills[slug];
  const ladder = ladderFor(slug, skill.currentStep);

  const daysSinceLast =
    skill.lastTrainedAt === null
      ? null
      : daysBetween(skill.lastTrainedAt, state.today);
  const hoursSinceLast =
    skill.lastTrainedAt === null
      ? null
      : hoursBetween(skill.lastTrainedAt, referenceInstant(state));

  const status = deriveStatus(skill);
  const progressionReady = isProgressionReady(skill, ladder);

  return {
    slug,
    order: ART_ORDER.indexOf(slug) + 1,
    status,
    currentStep: skill.currentStep,
    volumeTier: Math.min(skill.volumeTier, Math.max(0, ladder.length - 1)),
    daysSinceLast,
    hoursSinceLast,
    avgCompletion: weightedCompletion(skill.recentSessions),
    lastCompletion: skill.recentSessions[0]?.completionRatio ?? null,
    fatigueNow: fatigueNowOf(daysSinceLast, skill.lastFatigue),
    overlap48h: overlapWithRecent(slug, recentSkills),
    recentSkills,
    ladder,
    metric: metricFor(slug, skill.currentStep),
    progressionReady,
    progressionHint: progressionReady
      ? buildProgressionHint(slug, skill.currentStep)
      : null,
  };
}

/** 晋级提示文案（含「下一式叫什么」与安全附加） */
function buildProgressionHint(slug: ArtSlug, stepNo: number): string {
  const next = getMove(slug, stepNo + 1);
  if (!next) return `第 ${stepNo} 式已达标，这是本艺最后一式。`;
  const base = `第 ${stepNo} 式已连续达标，可以试试第 ${stepNo + 1} 式「${next.nameZh}」。`;
  return next.riskNote
    ? `${base}该式属高风险动作，请先看完动作要领并在保护下进行。`
    : base;
}

/** 由 `state` 派生全部六艺快照（48h 窗口先算出来，供重叠因子使用） */
export function buildSnapshots(state: TrainingState): SkillSnapshot[] {
  const reference = referenceInstant(state);

  // 先算 48h 窗口内的已训练艺，再算重叠 —— 两趟，避免顺序依赖。
  const recentSkills = ART_ORDER.filter((slug) => {
    const { lastTrainedAt } = state.skills[slug];
    if (lastTrainedAt === null) return false;
    return hoursBetween(lastTrainedAt, reference) <= OVERLAP.lookbackHours;
  });

  return ART_ORDER.map((slug) => buildSnapshot(slug, state, recentSkills));
}

/** 由自报次数反推训练量档（首次使用引导用） */
export function inferTierFor(
  artSlug: ArtSlug,
  stepNo: number,
  maxReps?: number,
): number {
  return inferTier(ladderFor(artSlug, stepNo), maxReps);
}

/** 六艺疲劳现值均值（项数抑制用，§7.3） */
export function averageFatigue(snapshots: SkillSnapshot[]): number {
  if (snapshots.length === 0) return FATIGUE.neutral;
  return (
    snapshots.reduce((sum, snapshot) => sum + snapshot.fatigueNow, 0) /
    snapshots.length
  );
}

/** 计算态里可读的完成度（0–1.2），解释文案用 */
export function rawAvgCompletion(snapshot: SkillSnapshot): number {
  return snapshot.avgCompletion;
}
