/**
 * 动态训练计划系统 · 全量可调配置（设计文档 §11）。
 *
 * **这是全系统唯一的调参入口**。改权重 / 阈值 / 矩阵 / 时间档预算都不需要碰算法代码。
 *
 * 每个字段都附「调参直觉」注释：调大调小会发生什么，一眼可读。
 * 本文件为纯常量，无副作用、不读环境、不读时间。
 */
import type { ArtSlug } from '@/types';

/* ---------------------------------------------------------------------------
 * 六艺负荷类型与重叠矩阵（§0.2）
 * ------------------------------------------------------------------------ */

/**
 * 训练类型重叠矩阵（0 = 无重叠，1 = 完全重叠）。
 *
 * 这是「六艺不是六个独立动作」的核心载体：
 * - `[s][s] = 1.00` → **昨天练过的项目今天被自然扣满分项**，
 *   需求里「昨天刚练过就降低优先级」由此**退化成一个通用公式**，不是特例判断；
 * - `[俯卧撑][倒立撑] = 0.60` → 同为推类，禁止连续叠加；
 * - `[桥][举腿] = 0.50` → 都压腰椎；
 * - `[深蹲][桥] = 0.40` → 都吃伸髋 / 后链。
 */
export const OVERLAP_MATRIX: Record<ArtSlug, Record<ArtSlug, number>> = {
  pushups: {
    pushups: 1.0,
    'handstand-pushups': 0.6,
    pullups: 0.1,
    squats: 0.1,
    'leg-raises': 0.1,
    bridges: 0.2,
  },
  'handstand-pushups': {
    pushups: 0.6,
    'handstand-pushups': 1.0,
    pullups: 0.2,
    squats: 0.1,
    'leg-raises': 0.2,
    bridges: 0.3,
  },
  pullups: {
    pushups: 0.1,
    'handstand-pushups': 0.2,
    pullups: 1.0,
    squats: 0.2,
    'leg-raises': 0.3,
    bridges: 0.35,
  },
  squats: {
    pushups: 0.1,
    'handstand-pushups': 0.1,
    pullups: 0.2,
    squats: 1.0,
    'leg-raises': 0.2,
    bridges: 0.4,
  },
  'leg-raises': {
    pushups: 0.1,
    'handstand-pushups': 0.2,
    pullups: 0.3,
    squats: 0.2,
    'leg-raises': 1.0,
    bridges: 0.5,
  },
  bridges: {
    pushups: 0.2,
    'handstand-pushups': 0.3,
    pullups: 0.35,
    squats: 0.4,
    'leg-raises': 0.5,
    bridges: 1.0,
  },
};

/** 六艺的主要训练类型标签（解释文案用） */
export const LOAD_TYPE_LABEL: Record<ArtSlug, string> = {
  pushups: '水平推',
  squats: '下肢',
  pullups: '垂直拉',
  'leg-raises': '核心',
  bridges: '后链 / 脊柱',
  'handstand-pushups': '垂直推',
};

/* ---------------------------------------------------------------------------
 * 优先级权重（§5.2）——3 加分 + 3 扣分，全部归一化后加权
 * ------------------------------------------------------------------------ */

export interface PlanWeights {
  /** 恢复缺失度。调大 → 更偏向「该练了」的项目 */
  recovery: number;
  /** 完成度健康度。调大 → 更偏向「做得顺」的项目 */
  completion: number;
  /** 推进链权重。调大 → 更坚守「一门一门推进」的原书方法论 */
  focus: number;
  /** 疲劳惩罚。调大 → 更保守，累了就换别的 */
  fatigue: number;
  /** 类型重叠惩罚。调大 → 更不允许连着练同一负荷类型 */
  overlap: number;
  /** 停滞惩罚。调大 → 连续失败的项目更快被雪藏 */
  stall: number;
}

/** 权重默认值（全系统唯一的权重入口） */
export const WEIGHTS: PlanWeights = {
  recovery: 0.35,
  completion: 0.2,
  focus: 0.25,
  fatigue: 0.3,
  overlap: 0.25,
  stall: 0.15,
};

/** 辅助训练的辅助分权重（§7.2） */
export const ASSIST_WEIGHTS = {
  /** 本身就该练（复用主优先级） */
  score: 0.5,
  /** 与主训互补（1 − 矩阵值） */
  complement: 0.3,
  /** 48h 内已练过的负荷别再叠加 */
  freshness: 0.2,
} as const;

/* ---------------------------------------------------------------------------
 * 各因子参数（§5.3 / §6.4）
 * ------------------------------------------------------------------------ */

/** 推进链权重（§5.3 ③）——「一门一门推进，不贪多」的载体 */
export const FOCUS = {
  /** 主练艺（原书顺序第一个未完成的艺） */
  primary: 1.0,
  /** 其他待推进 */
  others: 0.55,
  /** 已全部完成（实际已被门控排除） */
  mastered: 0.25,
} as const;

/** 恢复缺失度（§5.3 ①） */
export const RECOVERY = {
  /** 起点：刚练过的第二天不算「缺失」 */
  floorDays: 1,
  /** 满分点：5 天后视为完全恢复，此后不再增长（避免荒废项目长期霸榜） */
  fullDays: 5,
} as const;

/** 完成度健康度（§5.3 ②） */
export const COMPLETION = {
  /** 无任何历史记录时的默认完成度（中性，既不奖励也不惩罚没练过的项目） */
  noHistoryDefault: 0.75,
  /** 计算加权平均取最近几次 */
  window: 3,
  /** 归一化上限：容忍超额完成不产生畸形高分 */
  maxRatio: 1.2,
} as const;

/** 疲劳（§5.3 ④） */
export const FATIGUE = {
  /** 中性点（等于它不参与加减分） */
  neutral: 3,
  /** 每天衰减 40% —— 否则「上周很累」会一直罚到今天 */
  decayPerDay: 0.6,
} as const;

/** 重复负荷（§5.3 ⑤ / §7.2） */
export const OVERLAP = {
  /** 类型重叠回溯窗口（小时） */
  lookbackHours: 48,
  /** 辅助与主训的重叠上限：禁止「俯卧撑 + 倒立撑」这类双推组合 */
  maxWithMain: 0.6,
  /** 辅助之间的两两重叠上限：防止三个辅助互相重叠 */
  maxBetweenAssists: 0.6,
} as const;

/* ---------------------------------------------------------------------------
 * 硬门控（§4.2）
 * ------------------------------------------------------------------------ */

export const GATE = {
  /** 距上次训练不足这么多小时 → 排除（今天已经练过这个艺） */
  trainedTodayHours: 20,
  /** 疲劳达到此值且间隔 ≤ 48h → 排除 */
  highFatigueScore: 4.5,
  /** 停滞项目强制休息窗口（小时） */
  stallRestHours: 48,
  /** 候选池下限：过滤后不足此数则按排除优先级逐条放回（宁可排得不理想，也不给空白页） */
  minPool: 3,
  /** 放回顺序（先放回最"可以忍"的，把最该休息的留到最后） */
  returnOrder: ['STALLED', 'HIGH_FATIGUE', 'TRAINED_TODAY'] as const,
} as const;

/* ---------------------------------------------------------------------------
 * 疲劳对项数的抑制（§7.3）
 * ------------------------------------------------------------------------ */

export const ITEM_SUPPRESSION = {
  /** 六艺 fatigueNow 均值达到此值 → 少排一项 */
  highAvgFatigue: 4.0,
  /** 少排的项数 */
  reduceItems: 1,
} as const;

/* ---------------------------------------------------------------------------
 * 周计划缺口（本版新增 · 与原书方法论不冲突的落地方式）
 *
 * 决策记录：`daysPerWeek` **只作用于「项数」，不参与优先级打分**。
 * 理由：若把它做进 Priority Score，会给所有艺加同一个常量 → 改变不了排序，等于白加；
 * 若做成差异化加分，又会与 `daysSince` 重复计分（本周没轮到的艺，本来天数就大），
 * 属于「为了智能而增加的、没有实际意义的复杂度」。
 *
 * 因此改成最直白、最可解释的方式：
 *   本周剩余天数已经不足以补足训练次数缺口 → 今天多排 1 个辅助训练。
 * 周一缺口 3 天、剩 7 天 → 不动（时间还很充裕）；
 * 周六缺口 3 天、剩 2 天 → 加 1 项（确实该多练一点）。
 * ------------------------------------------------------------------------ */
export const WEEK_PLAN = {
  enabled: true,
  /** 触发时增加的项数 */
  bonusItems: 1,
} as const;

/* ---------------------------------------------------------------------------
 * 时间预算映射（§7.4）
 * ------------------------------------------------------------------------ */

export interface MinuteBudget {
  /** 最大项目数（含主训） */
  maxItems: number;
  /** 主训训练量档偏移（+1 需额外满足「轻松完成」条件，否则恒为 0） */
  mainVolumeOffset: number;
  /** 主训组间休息（秒） */
  restSeconds: number;
  /** 辅助组间休息（秒） */
  assistRestSeconds: number;
  /** 辅助组数上限 */
  assistSetCap: number;
  /** 是否提供加练自选池 */
  optionalPool: boolean;
}

/** 时间档 → 预算（§7.4） */
export const MINUTE_BUDGET: Record<15 | 30 | 45 | 60, MinuteBudget> = {
  15: {
    maxItems: 2,
    mainVolumeOffset: 0,
    restSeconds: 60,
    assistRestSeconds: 60,
    assistSetCap: 1,
    optionalPool: false,
  },
  30: {
    maxItems: 3,
    mainVolumeOffset: 0,
    restSeconds: 75,
    assistRestSeconds: 75,
    assistSetCap: 2,
    optionalPool: true,
  },
  45: {
    maxItems: 4,
    mainVolumeOffset: 0,
    restSeconds: 90,
    assistRestSeconds: 75,
    assistSetCap: 2,
    optionalPool: true,
  },
  60: {
    maxItems: 5,
    mainVolumeOffset: 1,
    restSeconds: 120,
    assistRestSeconds: 90,
    assistSetCap: 2,
    optionalPool: true,
  },
};

/** 项数硬上限（防止周缺口 + 时间档叠加后失控） */
export const MAX_ITEMS_CAP = 5;

/* ---------------------------------------------------------------------------
 * 耗时估算（§7.5）
 * ------------------------------------------------------------------------ */

/** 每次 / 每秒的耗时系数 */
export const ESTIMATE = {
  /** 每项的准备时间（秒） */
  prepSeconds: 60,
  /** 单次动作耗时（秒）—— 含离心控制 */
  secondsPerRep: {
    pushups: 4,
    'handstand-pushups': 4,
    pullups: 5,
    squats: 3,
    'leg-raises': 4,
    bridges: 4,
  } as Record<ArtSlug, number>,
  /** 加练自选池最多展示几项 */
  optionalPoolSize: 2,
} as const;

/* ---------------------------------------------------------------------------
 * 晋级 / 维持 / 降阶规则（§8.3）
 * ------------------------------------------------------------------------ */

export const PROGRESSION_DEFAULT = {
  /** 训练量档提升（同一式内加量） */
  tierUp: { easySessions: 2, minRatio: 1.0, maxAvgFatigue: 3.0 },
  /** Step 晋级（难度提升）—— 需训练量已达阶梯最高档，且用户确认 */
  promote: { minSessions: 2, minRatio: 1.0, maxAvgFatigue: 3.5, nearMissTolerance: 0.05 },
  /** 维持区间 */
  hold: { minRatio: 0.8 },
  /** 临时降量（一次性，不写回 tier） */
  softDown: { ratio: 0.7 },
  /** 正式降量 */
  tierDown: { ratio: 0.6, sessions: 2 },
  /** 停滞与降阶建议 */
  stall: { ratio: 0.6, sessions: 3, suggestSteps: 1 },
} as const;

/** 按难度分档的保守化覆写：越靠后越谨慎（§8.3） */
export const STEP_ADJUSTMENTS = {
  /** 从第几式起进入保守模式 */
  highStepFrom: 7,
  promote: { minSessions: 3, maxAvgFatigue: 3.0 },
  /** 更快识别停滞 */
  stall: { sessions: 2 },
} as const;

/* ---------------------------------------------------------------------------
 * 持久化与历史裁剪
 * ------------------------------------------------------------------------ */

/** 单键持久化（原子更新，避免多 key 不一致） */
export const STORAGE_KEY = 'cc.training.v1';

/** 存储版本号（结构变更时递增并做迁移） */
export const STORAGE_VERSION = 1;

/** 训练会话保留上限（超出裁剪最旧） */
export const SESSION_LIMIT = 200;

/** 每个艺保留的最近训练摘要条数（= 完成度计算窗口的上限） */
export const HISTORY_WINDOW = 5;

/* ---------------------------------------------------------------------------
 * 自评水平 → 冷启动预设 Step（§3.2）
 * ------------------------------------------------------------------------ */

export const LEVEL_PRESET_STEP: Record<
  'new' | 'some' | 'trained',
  Record<ArtSlug, number>
> = {
  new: {
    pushups: 1,
    squats: 1,
    pullups: 1,
    'leg-raises': 1,
    bridges: 1,
    'handstand-pushups': 1,
  },
  some: {
    pushups: 2,
    squats: 2,
    pullups: 1,
    'leg-raises': 1,
    bridges: 1,
    'handstand-pushups': 1,
  },
  trained: {
    pushups: 4,
    squats: 3,
    pullups: 3,
    'leg-raises': 2,
    bridges: 2,
    'handstand-pushups': 1,
  },
};
