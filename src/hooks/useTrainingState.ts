/**
 * 训练状态 hook —— 应用层（设计文档 §1.1）。
 *
 * 职责边界：
 * - **读写 localStorage**（经 `lib/plan/storage`）；
 * - **组装引擎输入**（`TrainingState`）并调用 `generateDailyPlan` / `replan`；
 * - **提供 actions** 把用户点击翻译成状态变更。
 *
 * **不含任何规则逻辑** —— 规则全部在 `lib/plan/**` 里，本文件只做「接与派」。
 * 这条边界是刻意的：引擎可以在 Node 里单测，本 hook 只需保证「点一下 → 状态对」。
 */
import { useCallback, useMemo, useState } from 'react';
import type { ArtSlug } from '@/types';
import type {
  AbortReason,
  DailyPlan,
  FatigueScore,
  PlanOptions,
  ProgressionVerdict,
  TrainingState,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';

import { generateDailyPlan, replan as replanEngine } from '@/lib/plan';
import { MINUTE_BUDGET } from '@/lib/plan/config';
import { applyVerdict, judgeSession, summarizeOutcome } from '@/lib/plan/progression';
import { clampStep, createEmptyStore, loadStore, pushSessionSummary, saveStore } from '@/lib/plan/storage';
import type { OnboardingAnswers, TrainingStore } from '@/lib/plan/storage';
import { ladderFor } from '@/lib/plan/snapshot';
import { inferTier } from '@/lib/plan/volumeLadder';
import { daysBetween, makeId } from '@/lib/plan/time';
import { allChecked, splitProgressionGoals, toggleCheck } from '@/lib/checklist';
import { getMove } from '@/data';

/* ---------------------------------------------------------------------------
 * 本地时间（真实运行时用；引擎本身不取时间）
 * ------------------------------------------------------------------------ */

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 今天（本地时区）`'YYYY-MM-DD'` */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 当前时刻（本地时区）`'YYYY-MM-DDTHH:mm:ss'` */
export function localNow(): string {
  const now = new Date();
  return `${localToday()}T${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
}

/* ---------------------------------------------------------------------------
 * 一次训练的执行结果（UI 回填）
 * ------------------------------------------------------------------------- */

/** 某一项的实际完成情况 */
export interface ExerciseResult {
  skill: ArtSlug;
  /** 逐组实际完成（顺序对应计划的每一组） */
  actualPerSet: (number | null)[];
  /** 是否中途放弃本项 */
  skipped: boolean;
}

/** 训练结束的回填数据 */
export interface SessionResult {
  results: ExerciseResult[];
  fatigue: FatigueScore;
  aborted: boolean;
  abortReason?: AbortReason;
  note?: string;
}

/* ---------------------------------------------------------------------------
 * Hook
 * ------------------------------------------------------------------------ */

export interface UseTrainingStateResult {
  store: TrainingStore;
  /** 引擎输入；未完成首次设置时为 `null` */
  state: TrainingState | null;
  /** 今日计划；未完成首次设置时为 `null` */
  plan: DailyPlan | null;
  /** 是否已完成首次设置 */
  ready: boolean;
  today: string;

  /* ---- 引导与设置 ---- */
  completeOnboarding: (answers: OnboardingAnswers) => void;
  setStep: (slug: ArtSlug, step: number) => void;
  setExcluded: (slug: ArtSlug, excluded: boolean) => void;
  resetAll: () => void;

  /* ---- 进度打卡 ---- */
  toggleStepCheck: (slug: ArtSlug, stepNo: number, index: number) => void;
  completeStep: (slug: ArtSlug, stepNo: number) => void;
  undoStep: (slug: ArtSlug, stepNo: number) => void;
  /** 某一式的进阶条件清单（自动从 `progressionStandard` 拆分） */
  goalsOf: (slug: ArtSlug, stepNo: number) => ReturnType<typeof splitProgressionGoals>;
  /** 某一式是否已勾满全部条件 */
  isStepSatisfied: (slug: ArtSlug, stepNo: number) => boolean;

  /* ---- 计划 ---- */
  /** 把当前（派生的）计划固化到存储，避免训练过程中计划漂移 */
  persistPlan: () => void;
  /** 套用用户调整（排除 / 换方案 / 改时间 / 加减量） */
  patchPlan: (patch: Partial<PlanOptions>) => void;
  /** 撤销当天全部调整 */
  resetPlanOptions: () => void;

  /* ---- 训练执行 ---- */
  finishSession: (input: SessionResult) => ProgressionVerdict[];

  /* ---- 派生展示值 ---- */
  /** 今天是否已经完成过一次训练 */
  trainedToday: boolean;
  /** 若页面长时间挂在后台跨了天，调用它把 `today` 复位 */
  refreshToday: () => void;
}

/** 由存储态组装引擎输入 */
function buildState(store: TrainingStore, today: string): TrainingState | null {
  if (!store.profile) return null;
  return {
    today,
    now: localNow(),
    profile: store.profile,
    skills: store.skills,
    sessions: store.sessions,
  };
}

export function useTrainingState(): UseTrainingStateResult {
  const [store, setStore] = useState<TrainingStore>(() => loadStore());
  const [today, setToday] = useState<string>(() => localToday());

  /** 统一的写入口：先落盘再更新内存（失败时内存态仍生效） */
  const commit = useCallback((updater: (prev: TrainingStore) => TrainingStore) => {
    setStore((prev) => {
      const next = updater(prev);
      saveStore(next);
      return next;
    });
  }, []);

  /** 跨天自动复位：日期变了就清掉旧计划 */
  const state = useMemo(() => buildState(store, today), [store, today]);

  /** 派生计划（未固化时即时生成 —— 引擎是纯函数且确定性，代价可忽略） */
  const derivedPlan = useMemo(() => {
    if (!state) return null;
    return generateDailyPlan(state, { today });
  }, [state, today]);

  const plan = useMemo(() => {
    if (store.todayPlan && store.todayPlan.date === today) return store.todayPlan;
    return derivedPlan;
  }, [store.todayPlan, today, derivedPlan]);

  /* -------------------------------------------------------------------------
   * 引导与设置
   * ---------------------------------------------------------------------- */

  const completeOnboarding = useCallback(
    (answers: OnboardingAnswers) => {
      commit((prev) => {
        // 从空状态重建六艺进度，但**保留已有训练历史**（重做引导不应抹掉练过的记录）
        const rebuilt = createEmptyStore();
        const skills = { ...rebuilt.skills };

        for (const slug of ART_ORDER) {
          const report = answers.selfReport[slug];
          const step = clampStep(report?.step ?? 1);
          skills[slug] = {
            ...rebuilt.skills[slug],
            currentStep: step,
            completedSteps:
              step > 1 ? Array.from({ length: step - 1 }, (_, i) => i + 1) : [],
            volumeTier: inferTier(ladderFor(slug, step), report?.maxReps),
          };
        }

        return {
          ...rebuilt,
          sessions: prev.sessions,
          skills,
          profile: {
            id: `local-${today}`,
            createdAt: localNow(),
            onboarding: {
              daysPerWeek: answers.daysPerWeek,
              sessionMinutes: answers.sessionMinutes,
              level: answers.level,
              selfReport: answers.selfReport,
            },
          },
        };
      });
    },
    [commit, today],
  );

  const setStep = useCallback(
    (slug: ArtSlug, step: number) => {
      const next = clampStep(step);
      commit((prev) => ({
        ...prev,
        skills: {
          ...prev.skills,
          [slug]: { ...prev.skills[slug], currentStep: next },
        },
        todayPlan: null,
      }));
    },
    [commit],
  );

  const setExcluded = useCallback(
    (slug: ArtSlug, excluded: boolean) => {
      commit((prev) => ({
        ...prev,
        skills: { ...prev.skills, [slug]: { ...prev.skills[slug], excluded } },
        todayPlan: null,
      }));
    },
    [commit],
  );

  const resetAll = useCallback(() => {
    commit(() => createEmptyStore());
  }, [commit]);

  /* -------------------------------------------------------------------------
   * 进度打卡
   * ---------------------------------------------------------------------- */

  const goalsOf = useCallback((slug: ArtSlug, stepNo: number) => {
    const move = getMove(slug, stepNo);
    return move ? splitProgressionGoals(move.progressionStandard) : [];
  }, []);

  const isStepSatisfied = useCallback(
    (slug: ArtSlug, stepNo: number) => {
      const goals = goalsOf(slug, stepNo);
      return allChecked(store.skills[slug].checks[stepNo], goals.length);
    },
    [goalsOf, store.skills],
  );

  const toggleStepCheck = useCallback(
    (slug: ArtSlug, stepNo: number, index: number) => {
      commit((prev) => {
        const skill = prev.skills[slug];
        const total = goalsOf(slug, stepNo).length;
        const current = skill.checks[stepNo];
        return {
          ...prev,
          skills: {
            ...prev.skills,
            [slug]: {
              ...skill,
              checks: { ...skill.checks, [stepNo]: toggleCheck(current, total, index) },
            },
          },
        };
      });
    },
    [commit, goalsOf],
  );

  /** 完成本式：记录已完成 + 推进到下一式（难度变更必须由用户点击驱动） */
  const completeStep = useCallback(
    (slug: ArtSlug, stepNo: number) => {
      commit((prev) => {
        const skill = prev.skills[slug];
        const completed = Array.from(new Set([...skill.completedSteps, stepNo])).sort(
          (a, b) => a - b,
        );
        const nextStep = Math.min(11, stepNo + 1);
        return {
          ...prev,
          skills: {
            ...prev.skills,
            [slug]: {
              ...skill,
              completedSteps: completed,
              currentStep: Math.max(skill.currentStep, nextStep),
              stepStartedAt: localNow(),
            },
          },
          todayPlan: null,
        };
      });
    },
    [commit],
  );

  /** 撤销完成：退回到本式（并把下一式从已完成里去掉） */
  const undoStep = useCallback(
    (slug: ArtSlug, stepNo: number) => {
      commit((prev) => {
        const skill = prev.skills[slug];
        return {
          ...prev,
          skills: {
            ...prev.skills,
            [slug]: {
              ...skill,
              completedSteps: skill.completedSteps.filter((item) => item < stepNo),
              currentStep: stepNo,
            },
          },
          todayPlan: null,
        };
      });
    },
    [commit],
  );

  /* -------------------------------------------------------------------------
   * 计划
   * ---------------------------------------------------------------------- */

  const persistPlan = useCallback(() => {
    commit((prev) => {
      if (prev.todayPlan && prev.todayPlan.date === today) return prev;
      const built = buildState(prev, today);
      if (!built) return prev;
      return { ...prev, todayPlan: generateDailyPlan(built, { today }) };
    });
  }, [commit, today]);

  const patchPlan = useCallback(
    (patch: Partial<PlanOptions>) => {
      commit((prev) => {
        const built = buildState(prev, today);
        if (!built) return prev;
        const current =
          prev.todayPlan && prev.todayPlan.date === today
            ? prev.todayPlan
            : generateDailyPlan(built, { today });
        return { ...prev, todayPlan: replanEngine(built, current, patch) };
      });
    },
    [commit, today],
  );

  const resetPlanOptions = useCallback(() => {
    commit((prev) => ({ ...prev, todayPlan: null }));
  }, [commit]);

  /* -------------------------------------------------------------------------
   * 训练执行 → 写回历史（闭环）
   * ---------------------------------------------------------------------- */

  const finishSession = useCallback(
    (input: SessionResult) => {
      const verdicts: ProgressionVerdict[] = [];
      const now = localNow();

      commit((prev) => {
        const built = buildState(prev, today);
        if (!built) return prev;

        const currentPlan =
          prev.todayPlan && prev.todayPlan.date === today
            ? prev.todayPlan
            : generateDailyPlan(built, { today });
        const plannedItems = [currentPlan.main, ...currentPlan.assists].filter(
          (item): item is NonNullable<typeof item> => item !== null,
        );

        const exercises: WorkoutExercise[] = [];
        let skills = { ...prev.skills };

        plannedItems.forEach((item, orderIndex) => {
          const result = input.results.find((entry) => entry.skill === item.skill);
          const sets: WorkoutSet[] = Array.from({ length: item.sets }, (_, index) => {
            const actual = result?.actualPerSet[index] ?? null;
            return {
              index,
              target: item.targetPerSet,
              actual,
              done: actual !== null && actual >= item.targetPerSet,
            };
          });

          const outcome = { ...summarizeOutcome(sets), metric: item.metric };
          const ladder = ladderFor(item.skill, item.stepNo);
          const verdict = judgeSession({
            skill: prev.skills[item.skill],
            ladder,
            outcome,
            fatigue: input.fatigue,
            aborted: input.aborted || Boolean(result?.skipped),
          });
          verdicts.push(verdict);

          const judgedSkill = applyVerdict(prev.skills[item.skill], verdict);
          skills[item.skill] = pushSessionSummary(
            {
              ...judgedSkill,
              lastTrainedAt: now,
              lastTrainedStep: item.stepNo,
              lastFatigue: input.fatigue,
            },
            {
              sessionId: currentPlan.id,
              date: today,
              stepNo: item.stepNo,
              volumeTier: item.volumeTier,
              metric: item.metric,
              plannedTotal: outcome.plannedTotal,
              actualTotal: outcome.actualTotal,
              completionRatio: outcome.completionRatio,
              fatigue: input.fatigue,
              aborted: input.aborted || Boolean(result?.skipped),
            },
          );

          exercises.push({
            skill: item.skill,
            stepNo: item.stepNo,
            role: item.role,
            metric: item.metric,
            volumeTier: item.volumeTier,
            order: orderIndex,
            restSeconds: item.restSeconds,
            sets,
            reason: item.reason,
          });
        });

        const session: WorkoutSession = {
          id: makeId('session', today, prev.sessions.length + 1),
          date: today,
          generatedAt: now,
          endedAt: now,
          availableMinutes: currentPlan.availableMinutes,
          kind: currentPlan.kind,
          mainSkill: currentPlan.main?.skill ?? null,
          exercises,
          state: 'done',
          planSnapshot: currentPlan,
          appliedOptions: currentPlan.appliedOptions,
          revision: currentPlan.revision,
          feedback: {
            sessionId: currentPlan.id,
            fatigue: input.fatigue,
            aborted: input.aborted,
            abortReason: input.abortReason,
            note: input.note,
            collectedAt: now,
          },
        };

        return {
          ...prev,
          skills,
          sessions: [session, ...prev.sessions].slice(0, 200),
          // 训练完成 → 今天的计划作废，下次进入用新状态重算（闭环的最后一环）
          todayPlan: null,
        };
      });

      return verdicts;
    },
    [commit, today],
  );

  /** 训练日判定辅助：今天是否已经练过 */
  const trainedToday = useMemo(
    () => store.sessions.some((session) => session.date === today && session.state === 'done'),
    [store.sessions, today],
  );

  /** 跨天检测（长时间挂着的页面回到前台时） */
  const refreshToday = useCallback(() => {
    const now = localToday();
    if (now !== today) setToday(now);
  }, [today]);

  return {
    store,
    state,
    plan,
    ready: store.profile !== null,
    today,
    completeOnboarding,
    setStep,
    setExcluded,
    resetAll,
    toggleStepCheck,
    completeStep,
    undoStep,
    goalsOf,
    isStepSatisfied,
    persistPlan,
    patchPlan,
    resetPlanOptions,
    finishSession,
    trainedToday,
    refreshToday,
  };
}

/** 单次训练时长的展示文案（供 UI 复用，避免重复硬编码） */
export function restLabel(minutes: 15 | 30 | 45 | 60): string {
  return `${MINUTE_BUDGET[minutes].restSeconds} 秒`;
}

/** 训练量档的展示文案 */
export function tierLabel(tier: number): string {
  return ['初级', '中级', '升阶'][tier] ?? `第 ${tier + 1} 档`;
}

/** 天数差（UI 展示「已 N 天未练」） */
export function daysSince(date: string | null, today: string): number | null {
  return date === null ? null : daysBetween(date, today);
}
