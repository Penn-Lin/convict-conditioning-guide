/**
 * 动态训练计划引擎单测。
 *
 * **夹具即设计文档 `docs/DYNAMIC-PLAN-DESIGN.md` §10 的模拟数据** ——
 * 文档里每一个数字（0.6225 / 0.0652 / 14.7 分钟 …）都在这里被断言。
 * 换句话说：改一行权重，这里会立刻告诉你哪些结论变了。
 *
 * 覆盖六个场景：
 * 1. §10.4 优先级打分与排名
 * 2. §10.5–10.6 主训 + 辅助 + 时间预算 + 耗时估算
 * 3. §10.8 排除某艺后重算
 * 4. §10.9 改时间档后重算
 * 5. §10.10 冷启动（零历史）
 * 6. §10.11 训练结束后的闭环（晋级判定）
 *
 * 外加：阶梯解析、门控、富文本高亮、进阶条件拆分、确定性。
 */
import { describe, expect, it } from 'vitest';

import type { ArtSlug } from '@/types';
import type { SessionSummary, TrainingSkill, TrainingState, WorkoutSession } from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';
import { splitProgressionGoals } from '@/lib/checklist';
import { highlight, highlightStats } from '@/lib/highlight';

import { generateDailyPlan, replan, weekCompletedCount } from './index';
import { buildSnapshots } from './snapshot';
import { applyGate } from './gate';
import { judgeSession, summarizeOutcome } from './progression';
import { parseVolumeLadder, inferTier } from './volumeLadder';

/* ---------------------------------------------------------------------------
 * 夹具（§10.1）
 * ------------------------------------------------------------------------ */

const TODAY = '2026-09-30';

/** 造一条训练摘要 */
function summary(date: string, ratio: number, fatigue: number): SessionSummary {
  return {
    sessionId: `s-${date}`,
    date,
    stepNo: 4,
    volumeTier: 1,
    metric: 'reps',
    plannedTotal: 24,
    actualTotal: Math.round(24 * ratio),
    completionRatio: ratio,
    fatigue: fatigue as SessionSummary['fatigue'],
    aborted: false,
  };
}

/** 造一个六艺存储态 */
function skill(
  slug: ArtSlug,
  currentStep: number,
  volumeTier: number,
  opts: {
    lastTrainedAt?: string | null;
    lastFatigue?: number | null;
    sessions?: SessionSummary[];
    consecutiveEasy?: number;
    consecutiveFail?: number;
  } = {},
): TrainingSkill {
  const sessions = opts.sessions ?? [];
  return {
    slug,
    currentStep,
    completedSteps: Array.from({ length: Math.max(0, currentStep - 1) }, (_, i) => i + 1),
    checks: {},
    stepStartedAt: null,
    volumeTier,
    lastTrainedAt: opts.lastTrainedAt ?? null,
    lastTrainedStep: opts.lastTrainedAt ? currentStep : null,
    recentSessions: sessions,
    lastFatigue: (opts.lastFatigue ?? null) as TrainingSkill['lastFatigue'],
    consecutiveEasy: opts.consecutiveEasy ?? 0,
    consecutiveFail: opts.consecutiveFail ?? 0,
    softDowngrade: false,
    excluded: false,
  };
}

/** §10.1 的六艺状态 */
const skills: Record<ArtSlug, TrainingSkill> = {
  pushups: skill('pushups', 4, 1, {
    lastTrainedAt: '2026-09-29T12:00:00',
    lastFatigue: 4,
    sessions: [summary('2026-09-29', 0.917, 4), summary('2026-09-26', 1.0, 3), summary('2026-09-23', 0.833, 3)],
  }),
  squats: skill('squats', 3, 1, {
    lastTrainedAt: '2026-09-23T12:00:00',
    lastFatigue: 3,
    sessions: [summary('2026-09-23', 0.933, 3), summary('2026-09-20', 1.0, 2)],
  }),
  pullups: skill('pullups', 4, 1, {
    lastTrainedAt: '2026-09-27T12:00:00',
    lastFatigue: 3,
    sessions: [summary('2026-09-27', 1.0, 3), summary('2026-09-24', 1.0, 3), summary('2026-09-21', 0.818, 3)],
  }),
  'leg-raises': skill('leg-raises', 2, 0),
  bridges: skill('bridges', 2, 1, {
    lastTrainedAt: '2026-09-25T12:00:00',
    lastFatigue: 2,
    sessions: [summary('2026-09-25', 1.0, 2), summary('2026-09-19', 1.0, 2)],
  }),
  'handstand-pushups': skill('handstand-pushups', 1, 0),
};

/** 一条最小可用会话（只为 `weekCompletedCount` 服务） */
function doneSession(date: string, mainSkill: ArtSlug): WorkoutSession {
  return {
    id: `s-${date}`,
    date,
    generatedAt: `${date}T20:00:00`,
    endedAt: `${date}T20:30:00`,
    availableMinutes: 45,
    kind: 'training',
    mainSkill,
    exercises: [],
    state: 'done',
    planSnapshot: null as unknown as WorkoutSession['planSnapshot'],
    appliedOptions: {},
    revision: 0,
  };
}

/** §10.1 的完整输入状态 */
const state: TrainingState = {
  today: TODAY,
  profile: {
    id: 'demo',
    createdAt: '2026-09-01T08:00:00',
    onboarding: {
      daysPerWeek: 4,
      sessionMinutes: 45,
      level: 'some',
      selfReport: {},
    },
  },
  skills,
  // 本周（09-28 起）已完成 1 次 → 周缺口因子不触发（详见 config.WEEK_PLAN）
  sessions: [doneSession('2026-09-29', 'pushups')],
};

/* ---------------------------------------------------------------------------
 * 1. §10.4 优先级打分
 * ------------------------------------------------------------------------ */

describe('priority · §10.4 打分与排名', () => {
  it('六个艺的因子与总分与文档一致', () => {
    const snaps = buildSnapshots(state);
    const byslug = Object.fromEntries(snaps.map((s) => [s.slug, s]));

    // 恢复缺失度
    expect(byslug.pushups.daysSinceLast).toBe(1);
    expect(byslug.squats.daysSinceLast).toBe(7);
    expect(byslug.bridges.daysSinceLast).toBe(5);
    expect(byslug['leg-raises'].daysSinceLast).toBeNull();

    // 加权平均完成度（最新权重最高）
    expect(byslug.pushups.avgCompletion).toBeCloseTo(0.9307, 3);
    expect(byslug.squats.avgCompletion).toBeCloseTo(0.9598, 3);
    expect(byslug.pullups.avgCompletion).toBeCloseTo(0.9697, 3);
    expect(byslug.bridges.avgCompletion).toBeCloseTo(1.0, 3);
    expect(byslug['leg-raises'].avgCompletion).toBeCloseTo(0.75, 3);

    // 疲劳现值（带日衰减）
    expect(byslug.pushups.fatigueNow).toBeCloseTo(3.6, 3);
    expect(byslug.squats.fatigueNow).toBeCloseTo(3.0, 3);

    // 48 小时窗口内只有 09-29 的俯卧撑
    expect(byslug.pushups.overlap48h).toBeCloseTo(1.0, 3);
    expect(byslug['handstand-pushups'].overlap48h).toBeCloseTo(0.6, 3);
    expect(byslug.bridges.overlap48h).toBeCloseTo(0.2, 3);
    expect(byslug.squats.overlap48h).toBeCloseTo(0.1, 3);
  });

  it('总分与文档 §10.4 一致（手算过的两个关键值）', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    const { scores } = plan;

    expect(scores.squats.total).toBeCloseTo(0.6225, 3);
    expect(scores.bridges.total).toBeCloseTo(0.6042, 3);
    expect(scores['leg-raises'].total).toBeCloseTo(0.5875, 3);
    expect(scores['handstand-pushups'].total).toBeCloseTo(0.4625, 3);
    expect(scores.pullups.total).toBeCloseTo(0.4491, 3);
    // 俯卧撑 focus 满分 1.00，却因「昨天练过 + 很累」垫底 —— 这就是可解释性
    expect(scores.pushups.total).toBeCloseTo(0.0652, 3);

    // 排名
    expect(scores.squats.rank).toBe(1);
    expect(scores.pushups.rank).toBe(6);
  });

  it('「昨天练过就降低优先级」是通用公式的结果，不是特例', () => {
    const snaps = buildSnapshots(state);
    const pushups = snaps.find((s) => s.slug === 'pushups');
    expect(pushups?.overlap48h).toBe(1);
    // 六个因子各自归一化后加权，没有一条 if (昨天练过) 的分支
    const plan = generateDailyPlan(state, { today: TODAY });
    const overlapFactor = plan.scores.pushups.factors.find((f) => f.key === 'overlap');
    expect(overlapFactor?.raw).toBe(1);
    expect(overlapFactor?.contribution).toBeCloseTo(-0.25, 4);
  });
});

/* ---------------------------------------------------------------------------
 * 2. §10.5–10.6 主训 + 辅助 + 时间预算
 * ------------------------------------------------------------------------ */

describe('selection & budget · §10.5–10.6', () => {
  it('主训是深蹲，不是桥（手算错过的那个）', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    expect(plan.kind).toBe('training');
    expect(plan.main?.skill).toBe('squats');
    expect(plan.main?.stepNo).toBe(3);
    expect(plan.main?.nameZh).toBe('支撑深蹲');
  });

  it('45 分钟档：2 组 × 15 次、休息 90 秒', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    expect(plan.main?.sets).toBe(2);
    expect(plan.main?.targetPerSet).toBe(15);
    expect(plan.main?.restSeconds).toBe(90);
    expect(plan.main?.estimatedMinutes).toBeCloseTo(4.0, 1);
  });

  it('辅助 = 举腿 + 引体向上 + 桥，且不含双推组合', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    expect(plan.assists.map((item) => item.skill)).toEqual([
      'leg-raises',
      'pullups',
      'bridges',
    ]);
    // 倒立撑（与俯卧撑同属推类）与俯卧撑都没被选为辅助
    expect(plan.assists.map((item) => item.skill)).not.toContain('handstand-pushups');
    expect(plan.assists.map((item) => item.skill)).not.toContain('pushups');
  });

  it('辅助组数受时间档上限约束，辅助休息 75 秒', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    const legRaises = plan.assists.find((item) => item.skill === 'leg-raises');
    const bridges = plan.assists.find((item) => item.skill === 'bridges');

    expect(legRaises?.sets).toBe(1); // 阶梯初级 1 组 × 10 次
    expect(legRaises?.restSeconds).toBe(75);
    expect(bridges?.sets).toBe(2); // 中级 2 组 × 20 次，cap 2
    expect(bridges?.targetPerSet).toBe(20);
  });

  it('总耗时 ≈ 14.7 分钟，且剩余时间被诚实说明（时间预算不填满）', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    expect(plan.totalEstimatedMinutes).toBeCloseTo(14.7, 1);
    expect(plan.freeMinutes).toBeCloseTo(30.3, 1);
    expect(plan.tips.join('')).toContain('热身');
    expect(plan.tips.join('')).toContain('原书训练量本就是短时段');
  });

  it('加练自选池提供但不自动加入', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    expect(plan.optional.map((item) => item.skill)).toEqual([
      'handstand-pushups',
      'pushups',
    ]);
    expect(plan.optional.every((item) => item.role === 'optional')).toBe(true);
  });

  it('解释文案由真实数值填充，不是写死的', () => {
    const plan = generateDailyPlan(state, { today: TODAY });
    const mainReason = plan.reasons.find((reason) => reason.skill === 'squats' && reason.code === 'RECOVERY_FULL');
    expect(mainReason?.text).toContain('7 天没有训练');
    expect(mainReason?.values.daysSince).toBe(7);

    // 俯卧撑与倒立撑都出现在「今天没有安排」里，且解释里带真实数值
    const pushupNote = plan.reasons.find(
      (reason) => reason.skill === 'pushups' && reason.text.includes('降低优先级'),
    );
    expect(pushupNote?.text).toContain('100%');
    const handstandNote = plan.reasons.find(
      (reason) => reason.skill === 'handstand-pushups' && reason.text.includes('降低优先级'),
    );
    expect(handstandNote?.text).toContain('60%');
  });

  it('硬门控没有误伤：六个艺全部进入候选池（「昨天练过」走打分而不是一刀切）', () => {
    const gate = applyGate(buildSnapshots(state), state.skills, { today: TODAY });
    expect(gate.pool).toHaveLength(6);
    expect(gate.excluded).toHaveLength(0);
  });

  it('今天已经练过的艺会被硬排除', () => {
    const trainedToday: TrainingState = {
      ...state,
      now: '2026-09-30T13:00:00',
      skills: {
        ...state.skills,
        squats: { ...state.skills.squats, lastTrainedAt: '2026-09-30T07:00:00' },
      },
    };
    const gate = applyGate(buildSnapshots(trainedToday), trainedToday.skills, {
      today: TODAY,
    });
    expect(gate.excluded.map((item) => item.skill)).toContain('squats');
    expect(gate.excluded.find((item) => item.skill === 'squats')?.code).toBe('TRAINED_TODAY');
  });
});

/* ---------------------------------------------------------------------------
 * 3. §10.8 排除某艺后重算
 * ------------------------------------------------------------------------ */

describe('replan · §10.8–10.9 用户主动修改', () => {
  it('「今天不想练引体」→ 主训不变、倒立撑递补，且不随机换动作', () => {
    const base = generateDailyPlan(state, { today: TODAY });
    const next = replan(state, base, { excludeSkills: ['pullups'] });

    expect(next.revision).toBe(base.revision + 1);
    expect(next.main?.skill).toBe('squats');
    expect(next.assists.map((item) => item.skill)).toEqual([
      'leg-raises',
      'bridges',
      'handstand-pushups',
    ]);
    // 解释里必须留下 USER_EXCLUDE，说明「因为你的调整，计划变成了这样」
    expect(next.reasons.some((reason) => reason.code === 'USER_EXCLUDE')).toBe(true);
  });

  it('「换一个方案」是确定性的：排除当前主训后取次优', () => {
    const base = generateDailyPlan(state, { today: TODAY });
    const next = replan(state, base, { avoidMain: 'squats' });
    expect(next.main?.skill).toBe('bridges');
  });

  it('改成 15 分钟 → 只保留主训 + 1 个辅助，休息压到 60 秒', () => {
    const base = generateDailyPlan(state, { today: TODAY });
    const next = replan(state, base, { availableMinutes: 15 });

    expect(next.main?.skill).toBe('squats');
    expect(next.main?.restSeconds).toBe(60);
    expect(next.main?.estimatedMinutes).toBeCloseTo(3.5, 1);
    expect(next.assists.map((item) => item.skill)).toEqual(['leg-raises']);
    expect(next.assists[0].sets).toBe(1);
    expect(next.totalEstimatedMinutes).toBeCloseTo(5.2, 1);
    expect(next.optional).toEqual([]); // 15 分钟档关闭加练池
  });

  it('减少训练量只作用于组数，不动单组次数', () => {
    const base = generateDailyPlan(state, { today: TODAY });
    const next = replan(state, base, { volumeScale: 0.6 });
    expect(next.main?.targetPerSet).toBe(base.main?.targetPerSet);
    expect(next.main?.sets).toBeLessThanOrEqual(base.main?.sets ?? 0);
    expect(next.reasons.some((reason) => reason.code === 'VOLUME_SCALE')).toBe(true);
  });

  it('确定性：同 state + 同 options 必然同结果（无 Math.random）', () => {
    const a = generateDailyPlan(state, { today: TODAY });
    const b = generateDailyPlan(state, { today: TODAY });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

/* ---------------------------------------------------------------------------
 * 4. §10.10 冷启动
 * ------------------------------------------------------------------------ */

describe('cold start · §10.10', () => {
  const coldSkills = {} as Record<ArtSlug, TrainingSkill>;
  for (const slug of ART_ORDER) coldSkills[slug] = skill(slug, 1, 0);

  const coldState: TrainingState = {
    ...state,
    skills: coldSkills,
    sessions: [],
  };

  it('零历史时主训 = 原书第一艺（俯卧撑），辅助 = 深蹲 + 引体 + 举腿', () => {
    const plan = generateDailyPlan(coldState, { today: TODAY });
    expect(plan.main?.skill).toBe('pushups');
    expect(plan.assists.map((item) => item.skill)).toEqual([
      'squats',
      'pullups',
      'leg-raises',
    ]);
  });

  it('不需要任何「首次使用特判」—— 是同一套公式在零数据下的自然输出', () => {
    const snaps = buildSnapshots(coldState);
    expect(snaps.every((snap) => snap.daysSinceLast === null)).toBe(true);
    expect(snaps.every((snap) => snap.avgCompletion === 0.75)).toBe(true);
    expect(snaps.every((snap) => snap.overlap48h === 0)).toBe(true);
  });

  it('周缺口：周六才触发加项（周三时间还充裕，不动）', () => {
    // 2026-09-30 是周三 → 剩 5 天，缺口 4 次 → 不加项
    expect(weekCompletedCount(state, '2026-09-30')).toBe(1);
    const wednesday = generateDailyPlan(state, { today: '2026-09-30' });
    expect(wednesday.assists).toHaveLength(3);

    // 2026-10-03 是周六 → 剩 2 天，缺口仍是 4 次 → 触发 +1 项
    const saturday = generateDailyPlan(state, { today: '2026-10-03' });
    expect(saturday.assists).toHaveLength(4);
    expect(saturday.reasons.some((reason) => reason.code === 'WEEK_DEFICIT')).toBe(true);
  });
});

/* ---------------------------------------------------------------------------
 * 5. §10.11 闭环
 * ------------------------------------------------------------------------ */

describe('closed loop · §10.11 训练结束后的判定', () => {
  const bridgesLadder = [
    { sets: 1, perSet: 10 },
    { sets: 2, perSet: 20 },
    { sets: 3, perSet: 40 },
  ];

  it('2 组 × 20 次全达成 + 反馈「正常」→ 轻松完成 → 提议升量档', () => {
    const outcome = summarizeOutcome([
      { index: 0, target: 20, actual: 20, done: true },
      { index: 1, target: 20, actual: 20, done: true },
    ]);
    expect(outcome.completionRatio).toBe(1);

    const verdict = judgeSession({
      skill: { ...skills.bridges, consecutiveEasy: 1 },
      ladder: bridgesLadder,
      outcome,
      fatigue: 3,
      aborted: false,
    });

    expect(verdict.outcome).toBe('easy');
    expect(verdict.suggestTierUp).toBe(true);
    expect(verdict.suggestedTier).toBe(2);
    expect(verdict.text).toContain('3 组 × 40 次');
  });

  it('训练量提升需要用户确认：判定只出「建议」，不改 currentStep', () => {
    const outcome = summarizeOutcome([
      { index: 0, target: 20, actual: 20, done: true },
      { index: 1, target: 20, actual: 20, done: true },
    ]);
    const skillBefore = { ...skills.bridges, consecutiveEasy: 1 };
    judgeSession({
      skill: skillBefore,
      ladder: bridgesLadder,
      outcome,
      fatigue: 3,
      aborted: false,
    });
    // 纯函数：入参没有被改写
    expect(skillBefore.currentStep).toBe(2);
    expect(skillBefore.volumeTier).toBe(1);
  });

  it('完成度 < 0.60 连续 3 次 → 停滞，建议降回上一式', () => {
    const outcome = summarizeOutcome([
      { index: 0, target: 20, actual: 8, done: false },
      { index: 1, target: 20, actual: 6, done: false },
    ]);
    const verdict = judgeSession({
      skill: { ...skills.bridges, consecutiveFail: 2 },
      ladder: bridgesLadder,
      outcome,
      fatigue: 5,
      aborted: false,
    });
    expect(verdict.outcome).toBe('hard_fail');
    expect(verdict.stalled).toBe(true);
    expect(verdict.suggestDemote).toBe(true);
    expect(verdict.softDowngrade).toBe(true);
  });

  it('完成后下一次生成：该艺退出前列（闭环成立）', () => {
    // 模拟桥刚练完 10 分钟前
    const after: TrainingState = {
      ...state,
      now: '2026-09-30T20:10:00',
      skills: {
        ...state.skills,
        bridges: {
          ...state.skills.bridges,
          lastTrainedAt: '2026-09-30T20:00:00',
          lastFatigue: 3,
          recentSessions: [summary('2026-09-30', 1.0, 3), ...state.skills.bridges.recentSessions],
        },
      },
    };
    const gate = applyGate(buildSnapshots(after), after.skills, { today: TODAY });
    expect(gate.excluded.find((item) => item.skill === 'bridges')?.code).toBe('TRAINED_TODAY');

    const plan = generateDailyPlan(after, { today: TODAY });
    expect(plan.main?.skill).not.toBe('bridges');
  });
});

/* ---------------------------------------------------------------------------
 * 6. 阶梯解析与工具函数
 * ------------------------------------------------------------------------ */

describe('volumeLadder · 从 trainingGoal 派生训练量阶梯', () => {
  it('次数型', () => {
    const parsed = parseVolumeLadder('初级 1 组 × 8 次 → 中级 2 组 × 12 次 → 升阶 2 组 × 25 次');
    expect(parsed.metric).toBe('reps');
    expect(parsed.ladder).toEqual([
      { sets: 1, perSet: 8 },
      { sets: 2, perSet: 12 },
      { sets: 2, perSet: 25 },
    ]);
    expect(parsed.fallback).toBe(false);
  });

  it('保持型：分钟换算为秒', () => {
    const parsed = parseVolumeLadder('初级 保持 30 秒 → 中级 保持 1 分钟 → 升阶 保持 2 分钟');
    expect(parsed.metric).toBe('hold');
    expect(parsed.ladder.map((tier) => tier.perSet)).toEqual([30, 60, 120]);
  });

  it('单侧动作的「（每侧）」不影响解析', () => {
    const parsed = parseVolumeLadder(
      '初级 1 组 × 5 次（每侧） → 中级 2 组 × 10 次（每侧） → 升阶 2 组 × 20 次（每侧）',
    );
    expect(parsed.ladder).toEqual([
      { sets: 1, perSet: 5 },
      { sets: 2, perSet: 10 },
      { sets: 2, perSet: 20 },
    ]);
  });

  it('自报次数反推训练量档（§3.2）', () => {
    const ladder = [
      { sets: 1, perSet: 8 },
      { sets: 2, perSet: 12 },
      { sets: 2, perSet: 25 },
    ];
    expect(inferTier(ladder, 12)).toBe(1);
    expect(inferTier(ladder, 30)).toBe(2);
    expect(inferTier(ladder, 5)).toBe(0);
    expect(inferTier(ladder, undefined)).toBe(0);
  });

  it('站内全部 60 式都能解析出三档（数据体检）', async () => {
    const { allMoves } = await import('@/data');
    const bad: string[] = [];
    for (const move of allMoves) {
      const parsed = parseVolumeLadder(move.trainingGoal);
      if (parsed.fallback || parsed.ladder.length < 3) bad.push(move.slug);
    }
    expect(bad).toEqual([]);
  });
});

describe('checklist · 进阶条件自动拆分', () => {
  it('逗号前后切成「数量目标 + 质量要求」', () => {
    const goals = splitProgressionGoals('3 组 × 50 次，全程直体成线、下沉至胸部近墙、无耸肩借力。');
    expect(goals.map((goal) => goal.text)).toEqual([
      '3 组 × 50 次',
      '全程直体成线',
      '下沉至胸部近墙',
      '无耸肩借力',
    ]);
    expect(goals[0].kind).toBe('quantity');
    expect(goals.slice(1).every((goal) => goal.kind === 'quality')).toBe(true);
  });

  it('无分隔符时整句作为唯一条件，绝不返回空清单', () => {
    const goals = splitProgressionGoals('保持 2 分钟');
    expect(goals).toHaveLength(1);
    expect(goals[0].kind).toBe('quantity');
  });

  it('站内 60 式的进阶条件都能拆出至少 1 条', async () => {
    const { allMoves } = await import('@/data');
    for (const move of allMoves) {
      expect(splitProgressionGoals(move.progressionStandard).length).toBeGreaterThan(0);
    }
  });
});

describe('highlight · 富文本高亮引擎', () => {
  it('计量数字命中 metric', () => {
    const tokens = highlight('3 组 × 50 次');
    expect(tokens.some((token) => token.kind === 'metric')).toBe(true);
  });

  it('风险词优先于正确做法词（不互相打脸）', () => {
    const tokens = highlight('保持核心收紧，不要塌腰');
    expect(tokens.find((token) => token.text.includes('不要'))?.kind).toBe('risk');
    expect(tokens.find((token) => token.text.includes('塌腰'))?.kind).toBe('risk');
    expect(tokens.find((token) => token.text.includes('保持'))?.kind).toBe('good');
  });

  it('还原后与原文完全一致（不丢字、不重排）', () => {
    const text = '下沉至胸部近墙，保持 2 秒，肩胛收紧，不要借力。';
    expect(highlight(text).map((token) => token.text).join('')).toBe(text);
  });

  it('站内 60 式正文解析后逐字无损', async () => {
    const { allMoves } = await import('@/data');
    for (const move of allMoves) {
      for (const field of [move.description, ...move.steps, ...move.keyPoints, ...move.commonMistakes]) {
        expect(highlight(field).map((token) => token.text).join('')).toBe(field);
      }
    }
  });

  it('四类高亮在同一段里都能出现', () => {
    const stats = highlightStats('保持 2 秒，肩胛收紧，不要塌腰，后链发力。');
    expect(stats.metric).toBeGreaterThan(0);
    expect(stats.good).toBeGreaterThan(0);
    expect(stats.risk).toBeGreaterThan(0);
    expect(stats.term).toBeGreaterThan(0);
  });
});
