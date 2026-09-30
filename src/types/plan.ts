/**
 * 动态训练计划系统 · 领域类型契约（设计文档 `docs/DYNAMIC-PLAN-DESIGN.md` §2）。
 *
 * 与 `src/types/index.ts`（六艺十式内容模型）**平级、互不侵入**：
 * - `src/types/index.ts` 描述「动作是什么」（60 式静态内容，只读）；
 * - 本文件描述「用户在练什么、练得怎么样、今天该练什么」（动态状态与计划产物）。
 *
 * 依赖方向单向：UI → hooks → engine → types。本文件不 import 任何运行时代码。
 */
import type { ArtSlug } from '@/types';

export type { ArtSlug };

/* ---------------------------------------------------------------------------
 * 基础枚举
 * ------------------------------------------------------------------------ */

/** 计量方式：次数型 / 保持型（倒立撑前几式为「保持 N 秒」） */
export type MetricKind = 'reps' | 'hold';

/** 主观疲劳评分：1 = 状态很好 → 5 = 很累（3 为中性） */
export type FatigueScore = 1 | 2 | 3 | 4 | 5;

/** 每次可用时间档（分钟） */
export type SessionMinutes = 15 | 30 | 45 | 60;

/** 六艺推进状态 */
export type SkillStatus = 'not_started' | 'active' | 'stalled' | 'mastered';

/** 一次训练的会话状态 */
export type SessionState = 'planned' | 'in_progress' | 'done' | 'skipped';

/** 计划中一项的角色 */
export type ItemRole = 'main' | 'assist' | 'optional';

/** 中途停止的原因 */
export type AbortReason = 'pain' | 'time' | 'energy' | 'other';

/** 首次使用时用户自评水平（只用于冷启动预设，不参与后续计算） */
export type SelfLevel = 'new' | 'some' | 'trained';

/** 训练量阶梯的单档（由 `Move.trainingGoal` 的三档派生） */
export interface VolumeTier {
  /** 组数 */
  sets: number;
  /** 单组目标：次数（`reps`）或秒数（`hold`） */
  perSet: number;
}

/* ---------------------------------------------------------------------------
 * 用户与六艺状态
 * ------------------------------------------------------------------------ */

/** 用户档案（单用户，本地存储） */
export interface UserProfile {
  id: string;
  createdAt: string;
  /** 首次使用引导的答案（最小集合，可跳过细节） */
  onboarding: {
    /** 每周大概训练几天 */
    daysPerWeek: 2 | 3 | 4 | 5 | 6;
    /** 每次通常多少时间（作为 /plan 页默认值，每天仍可改） */
    sessionMinutes: SessionMinutes;
    /** 自评水平 */
    level: SelfLevel;
    /** 用户逐项填写的当前式号 / 能完成的次数（可空） */
    selfReport: Partial<Record<ArtSlug, { step?: number; maxReps?: number }>>;
    /**
     * 排期模式（v4 新增）。缺失时按 `auto` 处理（老存档不惊动）。
     * 引导阶段由自评水平推导默认值，之后可在训练页随时切换。
     */
    scheduleMode?: ScheduleMode;
  };
}

/** 一次训练的摘要（倒序存放，长度上限 `config.historyWindow`） */
export interface SessionSummary {
  sessionId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  stepNo: number;
  volumeTier: number;
  metric: MetricKind;
  /** Σ 目标（次数或秒） */
  plannedTotal: number;
  /** Σ 实际 */
  actualTotal: number;
  /** actualTotal / plannedTotal */
  completionRatio: number;
  fatigue: FatigueScore | null;
  aborted: boolean;
}

/**
 * 六艺各一条的**存储态**（只记事实，不含派生判断）。
 * 派生计算态见 `SkillSnapshot`（每次生成计划时即时算出，可随配置变化重算）。
 */
export interface TrainingSkill {
  slug: ArtSlug;
  /** 当前所在式号 1–10；11 表示该艺十式全部完成 */
  currentStep: number;
  /** 已确认完成的式号（升序）；`currentStep` 由用户显式推进，两者不强制一致 */
  completedSteps: number[];
  /** 进阶条件逐项勾选状态：`checks[stepNo] = [true, false, ...]` */
  checks: Record<number, boolean[]>;
  /** 该式开始日期 */
  stepStartedAt: string | null;
  /** 训练量档下标，指向 `volumeLadder[tier]` */
  volumeTier: number;
  /** 最近一次训练时间（ISO，精确到秒） */
  lastTrainedAt: string | null;
  lastTrainedStep: number | null;
  /** 最近若干次训练摘要（**倒序**，最新的在前） */
  recentSessions: SessionSummary[];
  /** 最近一次训练的疲劳评分（原始值；衰减在 snapshot 中计算） */
  lastFatigue: FatigueScore | null;
  /** 连续「轻松完成」次数（训练量档提升判定用） */
  consecutiveEasy: number;
  /** 连续「明显失败」次数（降量 / 停滞判定用） */
  consecutiveFail: number;
  /** 临时降量标记：完成度异常低后，下一次该艺训练量降一档（一次性） */
  softDowngrade: boolean;
  /** 用户长期关闭该艺（「我的」里设置，非当天排除） */
  excluded: boolean;
  note?: string;
}

/* ---------------------------------------------------------------------------
 * 训练记录
 * ------------------------------------------------------------------------ */

export interface WorkoutSet {
  index: number;
  /** 目标次数或秒数 */
  target: number;
  /** 实际完成（null = 未记录） */
  actual: number | null;
  done: boolean;
}

export interface WorkoutExercise {
  skill: ArtSlug;
  stepNo: number;
  role: ItemRole;
  metric: MetricKind;
  volumeTier: number;
  order: number;
  restSeconds: number;
  sets: WorkoutSet[];
  /** 一句话理由（UI 直接展示） */
  reason: string;
}

export interface TrainingFeedback {
  sessionId: string;
  /** 必填：训练结束后一次 4 档反馈 */
  fatigue: FatigueScore;
  /** 是否中途停止 */
  aborted: boolean;
  abortReason?: AbortReason;
  note?: string;
  collectedAt: string;
}

export interface WorkoutSession {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  generatedAt: string;
  endedAt: string | null;
  availableMinutes: SessionMinutes;
  kind: 'training' | 'recovery';
  /** 主训艺；恢复日为 `null` */
  mainSkill: ArtSlug | null;
  exercises: WorkoutExercise[];
  state: SessionState;
  /** 生成时的快照，用于事后解释「当时为什么这么排」 */
  planSnapshot: DailyPlan;
  /** 用户对计划的主动修改 */
  appliedOptions: PlanOptions;
  /** 重算次数 */
  revision: number;
  feedback?: TrainingFeedback;
}

/* ---------------------------------------------------------------------------
 * 生成产物契约（UI 只认这一组）
 * ------------------------------------------------------------------------ */

export interface PlanItem {
  skill: ArtSlug;
  stepNo: number;
  nameZh: string;
  nameEn: string;
  role: ItemRole;
  metric: MetricKind;
  volumeTier: number;
  sets: number;
  /** 单组目标：次数或秒数 */
  targetPerSet: number;
  /** 组间休息秒数 */
  restSeconds: number;
  /** 预估耗时（分钟，保留 1 位） */
  estimatedMinutes: number;
  /** 一句话理由 */
  reason: string;
  /**
   * 本项是否为「进阶测试」——按原书高级标准（= 该式升阶档）排的一次挑战。
   *
   * 与普通项的差别只在**量**（升阶档，不受时间档上限约束）与**文案**；
   * 记录、判定、晋级流程完全一样。
   */
  challenge?: boolean;
}

/** 解释文案的语义代码（UI 按 code 选样式，文案由引擎给全） */
export type ReasonCode =
  | 'RECOVERY_FULL'
  | 'RECOVERY_MODERATE'
  | 'RECOVERY_RECENT'
  | 'NEVER_TRAINED'
  | 'COMPLETION_HIGH'
  | 'COMPLETION_LOW'
  | 'FATIGUE_HIGH'
  | 'FATIGUE_OK'
  | 'OVERLAP_RECENT'
  | 'COMPLEMENT_MAIN'
  | 'FOCUS_PRIMARY'
  | 'STALLED'
  | 'TIME_BUDGET'
  | 'WEEK_DEFICIT'
  | 'USER_EXCLUDE'
  | 'USER_ONLY'
  | 'SETS_DELTA'
  | 'TIER_FLOOR'
  | 'TEXTBOOK_SCHEDULE'
  | 'TEXTBOOK_ALL_RESTING'
  | 'TEXTBOOK_SOURCE'
  | 'PROGRESSION_READY'
  | 'RECOVERY_DAY'
  | 'SOFT_RETURN';

export interface PlanReason {
  skill?: ArtSlug;
  code: ReasonCode;
  /** 已用真实数值填好的最终文案 */
  text: string;
  /** 参与计算的真实数值（便于调试 / 后续 i18n / 单测断言） */
  values: Record<string, number | string>;
}

/** 被排除的项目及原因（透明度：让用户看到「今天为什么没排它」） */
export interface ExclusionRecord {
  skill: ArtSlug;
  code: ExclusionCode;
  text: string;
}

export type ExclusionCode =
  | 'TRAINED_TODAY'
  | 'HIGH_FATIGUE'
  | 'STALLED'
  | 'USER_EXCLUDE'
  | 'USER_ONLY'
  | 'MASTERED'
  | 'LOW_PRIORITY';

/** 优先级打分的完整明细（UI「为什么是它？」折叠面板直接渲染） */
export interface PriorityBreakdown {
  total: number;
  /** 排名（1 = 最高分） */
  rank: number;
  factors: {
    key: 'recovery' | 'completion' | 'focus' | 'fatigue' | 'overlap' | 'stall';
    /** 归一化后的因子值 0–1 */
    raw: number;
    weight: number;
    /** raw × weight（带符号） */
    contribution: number;
    /** 「7 天没有训练，恢复充分」这类一句人话 */
    text: string;
  }[];
}

/** 组数微调：比今天档位少一组 / 不变 / 多一组 */
export type SetsDelta = -1 | 0 | 1;

/**
 * 排期模式（本版新增）—— 决定「今天练哪几门」这一层由谁负责。
 *
 * 引擎分三步：① 选科目 → ② 定训练量 → ③ 时间账与闭环。
 * 本字段**只替换第 ① 步**，②③ 完全不区分模式。
 *
 * | 值 | 科目来源 | 依据 |
 * |---|---|---|
 * | `auto` | 引擎按恢复 / 完成度 / 疲劳 / 负荷重叠动态算 | 本站自研，适合生活不规律 |
 * | `textbook-beginner` | 固定四艺（俯卧撑 / 深蹲 / 引体 / 举腿） | 原书「初试身手」 |
 * | `textbook-steady` | 固定六艺全部 | 原书「渐入佳境」 |
 *
 * 前两者**不绑定星期几**：科目 = `距上次训练 ≥ TEXTBOOK_REST_DAYS 天` 的艺。
 * 隔天练时六门全部到期 → 每次都是六艺全练；一周出现 3 次还是 4 次都不用特殊处理
 * （隔天 = 7÷2 = 3.5 次/周，本就是 4 次周与 3 次周交替）。
 */
export type ScheduleMode = 'auto' | 'textbook-beginner' | 'textbook-steady';

/** 用户对计划的主动修改 —— 所有计划变体的唯一入参 */
export interface PlanOptions {
  /** 今天的实际可用时间 */
  availableMinutes?: SessionMinutes;
  /**
   * 今天的训练量档（0 初级 / 1 中级 / 2 升阶）。
   *
   * **只作用于当天，不写回长期进度。** 用来回答「我今天想练哪一档」——
   * 不传时由引擎按 `max(长期进度, 时间档下限)` 自动决定；
   * 用户想主动试更高档（例如「今天想试试升阶标准」）时可直接指定，
   * 练完仍按完成度判定，做不到会被软降量，长期状态不会被污染。
   */
  volumeTierOverride?: number;
  /**
   * 今天要做**进阶测试**的科目。
   *
   * 被点名的门会按**该式的升阶档**安排 —— 而升阶档就是原书「高级标准」，
   * 也正是 `progressionStandard` 逗号前那个数量目标（例如俯卧撑第 1 式的「3 组 × 50 次」）。
   *
   * 为什么需要它：日常计划按时间档排量（模板模式默认落在中级档 2 组 × 25 次），
   * 而「能不能进下一式」的判据是高级标准（3 组 × 50 次）——
   * **中间没有任何机制让用户真的把标准量做一遍**，于是记录抽屉里那条数量目标
   * 永远只能靠「感觉」去勾。这个字段就是那个缺失的机制：练一次真的，再决定要不要晋级。
   *
   * 与 `volumeTierOverride` 的差别：
   * - `volumeTierOverride` 是**整场统一**的档位；
   * - `challengeSkills` 是**逐门**的，且优先级更高、不受时间档上限约束
   *   （多出来的时长本来就是这个测试的代价）。
   */
  challengeSkills?: ArtSlug[];
  /**
   * 在今天档位的基础上，**每项各组数加减一组**（`-1` 减 / `0` 不变 / `1` 加）。
   *
   * 为什么是加减法而不是原来的乘法（`volumeScale: 1.2`）：
   * 全站训练量阶梯的组数只有 **1 / 2 / 3** 三种取值，`Math.round(2 × 1.2) === 2`
   * ——「增加训练量」对 1 组和 2 组的项目**完全无效**，用户点了看不出任何变化。
   * 加减法在小整数上一定生效，且语义更好解释：「比今天档位多一组」。
   *
   * 上限依据原书第十一章：「三组甚至四组也可以接受」，故单次训练量上限为 **4 组**。
   */
  setsDelta?: SetsDelta;
  /** 今天不练（软排除，仅影响当天，不写回长期状态） */
  excludeSkills?: ArtSlug[];
  /** 今天只想练这些（白名单） */
  onlySkills?: ArtSlug[];
  /** 「换一个方案」：排除当前主训后重算（确定性，非随机） */
  avoidMain?: ArtSlug;
  /** 当天临时切换排期模式（只作用于今天，不写回档案） */
  scheduleMode?: ScheduleMode;
  /** 'YYYY-MM-DD'；引擎**不取系统时间**，一律由调用方传入 */
  today?: string;
  /** 强制指定当日类型（恢复日兜底用） */
  forceKind?: 'training' | 'recovery';
}

/** 今日计划（引擎唯一的输出契约） */
export interface DailyPlan {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  generatedAt: string;
  revision: number;
  availableMinutes: SessionMinutes;
  kind: 'training' | 'recovery';

  /** 主训练（恢复日为 `null`） */
  main: PlanItem | null;
  assists: PlanItem[];
  /** 加练自选池：时间有富余时用户自行挑选，**不自动加入** */
  optional: PlanItem[];

  totalEstimatedMinutes: number;
  /**
   * 热身分钟数（原书：以低难度版本做两组，约 3 分钟）。
   * 与 `cooldownMinutes` 一起构成「固定开销」，参与剩余时间计算 ——
   * 否则会出现「选了 60 分钟，剩余 52 分钟，全叫你去热身」这种荒谬结论。
   */
  warmupMinutes: number;
  /** 训练后放松分钟数（原书不推荐系统冷却，只给最低额度 2 分钟） */
  cooldownMinutes: number;
  /** 真正富余的分钟数 = 可用时间 − 热身 − 训练 − 放松（已扣除固定开销） */
  freeMinutes: number;

  /** 一句话摘要（首页 / 计划页首屏） */
  summary: string;
  /**
   * 训练提示。必须把「热身 / 训练 / 放松」三段时间摆清楚，
   * 并说明组间休息是参考值（原书不设具体秒数上限）。
   */
  tips: string[];
  /** 结构化理由 */
  reasons: PlanReason[];
  /** 被排除的项目 */
  excluded: ExclusionRecord[];
  /** 六艺得分明细 */
  scores: Record<ArtSlug, PriorityBreakdown>;

  appliedOptions: PlanOptions;
}

/* ---------------------------------------------------------------------------
 * 派生计算态
 * ------------------------------------------------------------------------ */

/** 每次生成计划时即时派生的计算态（存储态只记事实，计算态可随配置重算） */
export interface SkillSnapshot {
  slug: ArtSlug;
  /** 原书顺序 1–6 */
  order: number;
  status: SkillStatus;
  currentStep: number;
  volumeTier: number;
  /** 距上次训练的天数；null = 从未训练 */
  daysSinceLast: number | null;
  /** 距上次训练的小时数（48h 重叠窗口用）；null = 从未训练 */
  hoursSinceLast: number | null;
  /** 最近 N 次加权平均完成度（权重 N..1，按可用记录归一化） */
  avgCompletion: number;
  lastCompletion: number | null;
  /** 疲劳现值（带日衰减），1–5 */
  fatigueNow: number;
  /** 与最近 48h 内已训练项目的最大重叠度 0–1 */
  overlap48h: number;
  /** 48h 窗口内训练过的艺（含自己） */
  recentSkills: ArtSlug[];
  /** 该式（currentStep）的训练量阶梯 */
  ladder: VolumeTier[];
  metric: MetricKind;
  /** 晋级是否就绪（达到全部 promote 条件）——只产生「建议」，绝不自动改 `currentStep` */
  progressionReady: boolean;
  progressionHint: string | null;
}

/** 引擎的输入状态（由 `useTrainingState` 组装；引擎本身不读 localStorage） */
export interface TrainingState {
  /** 'YYYY-MM-DD' */
  today: string;
  /**
   * 计算基准时刻（ISO，可选）。
   * 真实运行时传当前时刻；不传则退化为「今天中午 12:00」——
   * 这样按「天」记录的模拟数据能得到整数倍 24 小时，单测完全可复现。
   */
  now?: string;
  profile: UserProfile;
  skills: Record<ArtSlug, TrainingSkill>;
  sessions: WorkoutSession[];
}

/** 单次训练结束后的判定结果（§8.4） */
export interface ProgressionVerdict {
  completionRatio: number;
  outcome: 'easy' | 'normal' | 'near_miss' | 'hard_fail';
  /** 建议提升训练量档（需用户确认） */
  suggestTierUp: boolean;
  suggestedTier: number;
  /** 建议降低训练量档（需用户确认） */
  suggestTierDown: boolean;
  /** 建议降回上一式巩固（需用户确认） */
  suggestDemote: boolean;
  /** 是否达到停滞状态 */
  stalled: boolean;
  /** 下一次该艺是否应临时降量 */
  softDowngrade: boolean;
  text: string;
}
