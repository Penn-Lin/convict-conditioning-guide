/**
 * 训练状态的持久化层（设计文档 §2.4）。
 *
 * **单键存储**（`cc.training.v1`）：档案、六艺状态、训练历史、今日计划缓存在同一个对象里，
 * 一次 `setItem` 原子落盘 —— 避免多 key 写入中途失败导致状态互相矛盾。
 *
 * 纯静态站无后端；未来若上云，`TrainingSkill` 与 `WorkoutSession` 可直接映射为服务端表。
 */
import type { ArtSlug } from '@/types';
import type {
  DailyPlan,
  SelfLevel,
  SessionMinutes,
  TrainingSkill,
  UserProfile,
  WorkoutSession,
} from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';

import { HISTORY_WINDOW, LEVEL_PRESET_STEP, SESSION_LIMIT, STORAGE_KEY, STORAGE_VERSION } from './config';
import { ladderFor } from './snapshot';
import { inferTier } from './volumeLadder';

/** 落盘的完整状态（单键） */
export interface TrainingStore {
  version: number;
  /** null = 尚未完成首次使用引导 */
  profile: UserProfile | null;
  skills: Record<ArtSlug, TrainingSkill>;
  /** 训练会话（**最新在前**，上限 `SESSION_LIMIT`） */
  sessions: WorkoutSession[];
  /** 今日计划缓存（跨刷新保留，避免每次打开都重算导致解释文案闪烁） */
  todayPlan: DailyPlan | null;
}

/** 新建单个艺的空状态 */
export function createEmptySkill(slug: ArtSlug, step = 1): TrainingSkill {
  return {
    slug,
    currentStep: step,
    completedSteps: step > 1 ? range(1, step - 1) : [],
    checks: {},
    stepStartedAt: null,
    volumeTier: 0,
    lastTrainedAt: null,
    lastTrainedStep: null,
    recentSessions: [],
    lastFatigue: null,
    consecutiveEasy: 0,
    consecutiveFail: 0,
    softDowngrade: false,
    excluded: false,
  };
}

/** `[1..n]` */
function range(from: number, to: number): number[] {
  const list: number[] = [];
  for (let i = from; i <= to; i += 1) list.push(i);
  return list;
}

/** 全新的空状态（六艺均从第 1 式起步） */
export function createEmptyStore(): TrainingStore {
  const skills = {} as Record<ArtSlug, TrainingSkill>;
  for (const slug of ART_ORDER) skills[slug] = createEmptySkill(slug, 1);
  return { version: STORAGE_VERSION, profile: null, skills, sessions: [], todayPlan: null };
}

/** 首次使用引导的答案 */
export interface OnboardingAnswers {
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  sessionMinutes: SessionMinutes;
  level: SelfLevel;
  /** 逐项自报（可空，可只填一部分） */
  selfReport: Partial<Record<ArtSlug, { step?: number; maxReps?: number }>>;
}

/**
 * 由引导答案构造档案 + 六艺初始状态（冷启动，§3.2）。
 *
 * 用户只回答最小集合，系统反推一切：
 * - 自评水平 → 预设 Step；
 * - 每项自报 Step → 覆盖预设；
 * - 每项自报次数 → **反推训练量档**（在该式的阶梯里找 `perSet ≤ 自报次数` 的最大档）。
 */
export function buildStoreFromOnboarding(
  answers: OnboardingAnswers,
  now: string,
): TrainingStore {
  const preset = LEVEL_PRESET_STEP[answers.level];
  const skills = {} as Record<ArtSlug, TrainingSkill>;

  for (const slug of ART_ORDER) {
    const report = answers.selfReport[slug];
    const step = clampStep(report?.step ?? preset[slug]);
    const skill = createEmptySkill(slug, step);
    skill.volumeTier = inferTier(ladderFor(slug, step), report?.maxReps);
    skills[slug] = skill;
  }

  const profile: UserProfile = {
    id: `local-${now.slice(0, 10)}`,
    createdAt: now,
    onboarding: {
      daysPerWeek: answers.daysPerWeek,
      sessionMinutes: answers.sessionMinutes,
      level: answers.level,
      selfReport: answers.selfReport,
    },
  };

  return { version: STORAGE_VERSION, profile, skills, sessions: [], todayPlan: null };
}

/** 把式号钳到 1–10 */
export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.min(10, Math.max(1, Math.round(step)));
}

/* ---------------------------------------------------------------------------
 * 读写（全部容错：隐私模式 / 配额超限 / 脏数据一律静默降级）
 * ------------------------------------------------------------------------ */

/** 从 localStorage 读取状态；失败或版本不符时返回全新状态 */
export function loadStore(): TrainingStore {
  if (typeof window === 'undefined') return createEmptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return createEmptyStore();
    const parsed = JSON.parse(raw) as Partial<TrainingStore>;
    return migrate(parsed);
  } catch {
    return createEmptyStore();
  }
}

/** 写入状态；失败不抛异常（仅内存态生效） */
export function saveStore(store: TrainingStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* 写入失败不阻塞 UI */
  }
}

/**
 * 认识的历史版本号（从旧到新）。
 *
 * **每加一个版本都要往这里追加**，否则老用户的数据会因为「版本不认识」
 * 被整份丢弃 —— 那等于把人练了几个月的东西一次抹掉，是不可接受的失败方式。
 */
const KNOWN_VERSIONS: readonly number[] = [1, 2, 3];

/**
 * 结构迁移与补全。
 *
 * 容错重点：任何字段缺失都要补上，让「旧数据 + 新版本代码」也能正常工作，
 * 而不是整份丢弃让用户白练。
 *
 * ## 版本历史
 * - **v1 → v2**：`DailyPlan` 新增热身 / 放松分钟数与训练量档覆盖字段。
 * - **v2 → v3**：训练量微调从 `volumeScale`（乘组数）改为 `setsDelta`（±1 组）。
 *   乘法的旧字段会被忽略，故旧版固化的今日计划直接丢弃。
 *
 * 两版的共同处理：**今天已固化的计划一律丢弃**（次日按日重算，零损失），
 * 训练历史与六艺进度**全部保留**。
 */
export function migrate(input: Partial<TrainingStore>): TrainingStore {
  const base = createEmptyStore();
  if (typeof input.version !== 'number' || !KNOWN_VERSIONS.includes(input.version)) {
    return base;
  }

  const skills = {} as Record<ArtSlug, TrainingSkill>;
  for (const slug of ART_ORDER) {
    skills[slug] = {
      ...createEmptySkill(slug, 1),
      ...(input.skills?.[slug] ?? {}),
      slug,
      checks: input.skills?.[slug]?.checks ?? {},
    };
  }

  return {
    version: STORAGE_VERSION,
    profile: input.profile ?? null,
    skills,
    sessions: (input.sessions ?? []).slice(0, SESSION_LIMIT),
    todayPlan: input.version === STORAGE_VERSION ? input.todayPlan ?? null : null,
  };
}

/** 追加一条训练摘要并裁剪到窗口上限（返回新数组，最新在前） */
export function pushSessionSummary(
  skill: TrainingSkill,
  summary: TrainingSkill['recentSessions'][number],
): TrainingSkill {
  return {
    ...skill,
    recentSessions: [summary, ...skill.recentSessions].slice(0, HISTORY_WINDOW),
  };
}
