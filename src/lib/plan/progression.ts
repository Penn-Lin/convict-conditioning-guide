/**
 * 晋级 / 维持 / 降阶判定（设计文档 §8.4）。
 *
 * **两个维度严格分离**：
 * - **动作难度**（`currentStep` 1–10）：基础 → 进阶 → 高阶，**需要用户确认才变**；
 * - **训练量**（`volumeTier` 0–2）：初级 → 中级 → 升阶，**同一式内先加量**。
 *
 * 难度从不因为「练了几次」自动上升。`progressionReady` 只产生**建议**，
 * 所有对持久化状态的修改都由 UI 上用户点击确认后写入。
 */
import type { ArtSlug } from '@/types';
import type {
  FatigueScore,
  ProgressionVerdict,
  TrainingSkill,
  VolumeTier,
  WorkoutSession,
  WorkoutSet,
} from '@/types/plan';
import { getMove } from '@/data';

import { FATIGUE, PROGRESSION_DEFAULT, STEP_ADJUSTMENTS } from './config';
import { formatVolume } from './volumeLadder';

/* ---------------------------------------------------------------------------
 * 顺位门控（六艺十式是**线性阶梯**，不是 10 个独立目标）
 * ------------------------------------------------------------------------
 * 存在的理由（用户实测踩到的）：在详情页翻到第 3 式时误点了「完成本式」，
 * `currentStep` 直接跳到 4，而第 1、2 式其实一次都没打卡 —— 进度链条断在中间。
 *
 * 引擎与 hooks 都只做**事实记录**，无法靠自己知道「1、2 没做」这件事是否允许；
 * 因此把判据收敛到这两个纯函数里，UI / hooks / 单测共用同一份定义。
 * ------------------------------------------------------------------------ */

/** 第 `stepNo` 式之前**尚未完成**的式号（升序）；空数组 = 允许完成本式 */
export function missingPrerequisites(skill: TrainingSkill, stepNo: number): number[] {
  const done = new Set(skill.completedSteps);
  const missing: number[] = [];
  for (let step = 1; step < stepNo; step += 1) {
    if (!done.has(step)) missing.push(step);
  }
  return missing;
}

/** 本式是否可以标记完成（前面的式已全部完成） */
export function isStepUnlocked(skill: TrainingSkill, stepNo: number): boolean {
  return missingPrerequisites(skill, stepNo).length === 0;
}

/** 汇总实况 */
export interface SessionOutcome {
  plannedTotal: number;
  actualTotal: number;
  completionRatio: number;
  metric: WorkoutSession['exercises'][number]['metric'];
  /** 达到计划量才算「完成」的组数 */
  completedSets: number;
  setCount: number;
}

/**
 * 汇总本次训练的实际完成情况。
 *
 * 先按「每组是否有记录」分别求和，最后算 `实际 / 目标`。
 * 目标为 0 时（异常数据）按 1 处理，避免除零把比例打成 Infinity。
 */
export function summarizeOutcome(sets: WorkoutSet[]): SessionOutcome {
  const plannedTotal = sets.reduce((sum, set) => sum + set.target, 0);
  const actualTotal = sets.reduce((sum, set) => sum + (set.actual ?? 0), 0);
  const safePlanned = plannedTotal > 0 ? plannedTotal : 1;

  return {
    plannedTotal,
    actualTotal,
    completionRatio: Math.round((actualTotal / safePlanned) * 10000) / 10000,
    metric: 'reps',
    completedSets: sets.filter((set) => set.done).length,
    setCount: sets.length,
  };
}

/** 疲劳档位（1 状态很好 → 5 很累）对应的中文标签 */
export const FATIGUE_LABEL: Record<FatigueScore, string> = {
  1: '状态很好',
  2: '状态不错',
  3: '正常',
  4: '有点累',
  5: '很累',
};

/** UI 的 4 档按钮 → 疲劳分值（训练结束后一次单击） */
export const FATIGUE_BUTTONS: { score: FatigueScore; label: string }[] = [
  { score: 1, label: '状态很好' },
  { score: 2, label: '状态不错' },
  { score: 3, label: '正常' },
  { score: 5, label: '很累' },
];

/**
 * 训练结束后的四条判定（§8.4）。
 *
 * ```
 * ① 轻松完成   ratio ≥ 1.00 且 fatigue ≤ 3  → easyRun + 1；连续 N 次 → 提议 tier + 1
 * ② 正常完成   0.80 ≤ ratio < 1.00        → 量不变
 * ③ 未完成     0.70 ≤ ratio < 0.80        → 不计入晋级推进
 * ④ 明显失败   ratio < 0.60               → failRun + 1；软降量；连续 N 次 → stalled
 * ```
 */
export function judgeSession(input: {
  skill: TrainingSkill;
  ladder: VolumeTier[];
  outcome: SessionOutcome;
  fatigue: FatigueScore;
  aborted: boolean;
}): ProgressionVerdict {
  const { skill, ladder, outcome, fatigue, aborted } = input;
  const rules = PROGRESSION_DEFAULT;
  const isHighStep = skill.currentStep >= STEP_ADJUSTMENTS.highStepFrom;
  const stallRule = isHighStep
    ? { ...rules.stall, ...STEP_ADJUSTMENTS.stall }
    : rules.stall;

  const ratio = outcome.completionRatio;
  const maxTier = Math.max(0, ladder.length - 1);

  const isEasy = ratio >= rules.tierUp.minRatio && fatigue <= FATIGUE.neutral;
  const isNearMiss = !isEasy && ratio >= 0.8 && ratio < rules.tierUp.minRatio;
  const isHardFail = ratio < stallRule.ratio;

  const easyRun = isEasy ? skill.consecutiveEasy + 1 : 0;
  const failRun = isHardFail ? skill.consecutiveFail + 1 : isNearMiss ? skill.consecutiveFail : 0;

  const suggestTierUp =
    isEasy &&
    easyRun >= rules.tierUp.easySessions &&
    skill.volumeTier < maxTier;

  const suggestTierDown =
    ratio < rules.tierDown.ratio && skill.volumeTier > 0;

  const stalled = failRun >= stallRule.sessions;
  const softDowngrade = ratio < rules.stall.ratio;

  const outcomeKind: ProgressionVerdict['outcome'] = isEasy
    ? 'easy'
    : isNearMiss
      ? 'normal'
      : ratio >= 0.7
        ? 'near_miss'
        : 'hard_fail';

  const nextTier = suggestTierUp
    ? Math.min(maxTier, skill.volumeTier + 1)
    : skill.volumeTier;
  const nextTierValue = ladder[nextTier] ?? ladder[Math.max(0, ladder.length - 1)];

  return {
    completionRatio: ratio,
    outcome: outcomeKind,
    suggestTierUp,
    suggestedTier: nextTier,
    suggestTierDown,
    suggestDemote: stalled,
    stalled,
    softDowngrade,
    text: verdictText({
      artSlug: skill.slug,
      stepNo: skill.currentStep,
      outcome: outcomeKind,
      metric: outcome.metric,
      suggestTierUp,
      suggestTierDown,
      stalled,
      aborted,
      nextTierValue,
      currentTierValue: ladder[Math.min(skill.volumeTier, maxTier)],
      nextTierIndex: nextTier,
      ratio,
    }),
  };
}

/** 判定结论文案 */
function verdictText(input: {
  artSlug: ArtSlug;
  stepNo: number;
  outcome: ProgressionVerdict['outcome'];
  metric: WorkoutSession['exercises'][number]['metric'];
  suggestTierUp: boolean;
  suggestTierDown: boolean;
  stalled: boolean;
  aborted: boolean;
  nextTierValue: VolumeTier;
  currentTierValue: VolumeTier;
  nextTierIndex: number;
  ratio: number;
}): string {
  const percent = Math.round(input.ratio * 100);

  if (input.stalled) {
    const back = getMove(input.artSlug, Math.max(1, input.stepNo - 1));
    return `连续多次未完成（本次完成度 ${percent}%），建议先降回第 ${Math.max(1, input.stepNo - 1)} 式${back ? `「${back.nameZh}」` : ''}巩固，或把训练量降到初级标准。`;
  }

  if (input.suggestTierUp) {
    return `已连续达标，下次可以试试 ${formatVolume(input.metric, input.nextTierValue.sets, input.nextTierValue.perSet)}（第 ${input.nextTierIndex + 1} 档）。确认后才会生效。`;
  }

  if (input.suggestTierDown) {
    return `本次完成度只有 ${percent}%，下次会把训练量降到 ${formatVolume(input.metric, input.currentTierValue.sets, input.currentTierValue.perSet)} 再练一次。`;
  }

  if (input.outcome === 'easy') {
    return `完成度 ${percent}%，很轻松。再连续达标一次即可提升训练量。`;
  }

  if (input.aborted) {
    return `本次中途停止（完成度 ${percent}%）。难度不变，下次用同样的量再练一次。`;
  }

  if (input.outcome === 'normal') {
    return `完成度 ${percent}%，基本达标，训练量维持不变。`;
  }

  return `完成度 ${percent}%，接近但未达标。本次不计入晋级推进，下次再用同样的量练一次。`;
}

/** 训练结束后，把判定结果应用到该艺的存储态（纯函数，返回新对象） */
export function applyVerdict(
  skill: TrainingSkill,
  verdict: ProgressionVerdict,
): TrainingSkill {
  return {
    ...skill,
    volumeTier: verdict.suggestTierUp ? verdict.suggestedTier : skill.volumeTier,
    consecutiveEasy: verdict.outcome === 'easy' ? skill.consecutiveEasy + 1 : 0,
    consecutiveFail: verdict.outcome === 'hard_fail' ? skill.consecutiveFail + 1 : 0,
    softDowngrade: verdict.softDowngrade,
  };
}

/** 疲劳中性值再导出（UI 侧不重复硬编码） */
export const NEUTRAL_FATIGUE = FATIGUE.neutral;
