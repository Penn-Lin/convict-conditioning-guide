# 动态训练计划生成系统 · 设计文档

> 版本 v1.0 · 2026-09-30 · 纯规则驱动（无 AI / 无 ML）
>
> 本文档只做设计，不含实现。目标：规则透明、可解释、可配置、易实现。

---

## 0. 设计前提与关键发现

### 0.1 与现有站点数据的关系（重要）

本项目的 60 式数据（`src/data/arts/*.ts`）**已经包含了训练量阶梯与晋级目标**，无需新建规则表：

| 现有字段 | 实际内容（示例：俯卧撑第 4 式 半俯卧撑） | 在本系统中的角色 |
|---|---|---|
| `trainingGoal` | `初级 1 组 × 8 次 → 中级 2 组 × 12 次 → 升阶 2 组 × 25 次` | **训练量阶梯 volumeLadder**（三档） |
| `progressionStandard` | `2 组 × 25 次，全程身体成直线、下沉至髋部触及球体、无借球回弹。` | **晋级目标 + 质量验收项** |
| `stepNo` / `nameZh` | `4` / `半俯卧撑` | **动作难度**（与训练量严格分离） |
| `riskNote` | 桥全系 / 倒立撑全系 / 各艺 8–10 式 | 晋级时附加安全提示 |

**两条推论（贯穿全文）**：

1. **难度（Step）与训练量（VolumeTier）必须分离**，这是需求第七节的硬要求。Step 来自 `stepNo`，训练量来自 `volumeLadder` 的下标，二者互不联动。
2. 指标有两种：**次数型**（`reps`，推/拉/腿/核心）与**保持型**（`hold`，倒立撑全系为「保持 N 秒」）。所有涉及"量"的公式必须走统一的 `metric` 抽象。

### 0.2 六艺负荷类型与重叠矩阵

不把六艺看作六个独立动作，用**一张重叠矩阵**表达训练类型冲突（`0` = 无重叠，`1` = 完全重叠）。这是配置项，可随时调。

| | 俯卧撑<br>水平推 | 倒立撑<br>垂直推 | 引体<br>垂直拉 | 深蹲<br>下肢 | 举腿<br>核心 | 桥<br>后链/脊柱 |
|---|---|---|---|---|---|---|
| **俯卧撑** | 1.00 | 0.60 | 0.10 | 0.10 | 0.10 | 0.20 |
| **倒立撑** | 0.60 | 1.00 | 0.20 | 0.10 | 0.20 | 0.30 |
| **引体** | 0.10 | 0.20 | 1.00 | 0.20 | 0.30 | 0.35 |
| **深蹲** | 0.10 | 0.10 | 0.20 | 1.00 | 0.20 | 0.40 |
| **举腿** | 0.10 | 0.20 | 0.30 | 0.20 | 1.00 | 0.50 |
| **桥** | 0.20 | 0.30 | 0.35 | 0.40 | 0.50 | 1.00 |

解读：俯卧撑与倒立撑同为推类（0.60，昨天练了俯卧撑今天就不该练倒立撑）；桥与举腿都压腰椎（0.50）；深蹲与桥都吃伸髋/后链（0.40）。

---

## 1. 整体系统架构

### 1.1 分层

```
┌─────────────────────────────────────────────────────────────────┐
│ UI 层（React）                                                   │
│   /plan 计划页 · 首页今日卡 · 训练执行页 · 六艺进度时间线          │
│   —— 只消费 DailyPlan 契约，不含任何规则逻辑                      │
├─────────────────────────────────────────────────────────────────┤
│ 应用层  src/hooks/useTrainingState.ts                            │
│   读写 localStorage · 派发事件 · 提供 state 与 actions            │
├─────────────────────────────────────────────────────────────────┤
│ 规则引擎层  src/lib/plan/**（纯函数，无副作用，无 UI 依赖）        │
│   snapshot → gate → score → select → budget → estimate → explain │
│   输入：(TrainingState, PlanOptions, PlanConfig)                  │
│   输出：DailyPlan（确定性 · 幂等 · 可单测）                        │
├─────────────────────────────────────────────────────────────────┤
│ 配置层  src/lib/plan/config.ts                                    │
│   全部权重 / 阈值 / 矩阵 / 时间档预算 —— 单一可调入口              │
├─────────────────────────────────────────────────────────────────┤
│ 数据层  src/data/arts/*.ts（现有 60 式，只读）                     │
│   类型层 src/types/plan.ts（领域契约）                            │
└─────────────────────────────────────────────────────────────────┘
```

**依赖方向单向**：UI → hooks → engine → config/data。引擎**绝不** import React、绝不读 localStorage、绝不取当前时间（时间由调用方以参数传入）——这样它可以在 Node 里跑单测。

### 1.2 数据流（闭环）

```
localStorage ──► TrainingState
                    │
   ① snapshot()  ──┴─► SkillSnapshot[]   (daysSince / completion / fatigueNow / status)
   ② gate()          ─► 候选池 + 排除清单（每条含排除原因）
   ③ score()         ─► PriorityScore[]  (分项因子 + 加权总分)
   ④ selectMain()    ─► main
   ⑤ selectAssists() ─► assists[]        (互补性 + 分散约束)
   ⑥ budget()        ─► 项数 / 组次 / 休息 / 加练池
   ⑦ estimate()      ─► 预估耗时 + 剩余时间
   ⑧ explain()       ─► PlanReason[]     (结构化理由，文案由真实数值填充)
                    │
                    ▼
              DailyPlan（契约）
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   用户执行训练            用户主动修改（排除/换方案/改量）
        │                       │
        ▼                       └──► 回到 ② 用新 Options 重算
   WorkoutSession + TrainingFeedback
        │
        ▼
   写回 localStorage ──► 下一次生成
```

### 1.3 三条设计原则

1. **完全确定性，零随机**。「换一个方案」= 排除当前主训后重算，而不是掷骰子。同分时用原书顺序（`artOrder`）做 tie-break。好处：结果可复现、可单测、可解释。
2. **唯一生成入口**。所有计划变体（首次生成、排除某艺、换方案、加减量、限定时长）都调用同一个 `generateDailyPlan(state, options, config)`，差异全部收敛到 `options`。不存在第二条生成路径。
3. **引擎不写状态**。引擎只产出「建议」，所有对持久化状态的修改（tier 提升、Step 晋级、降阶）都由 UI 上用户点击确认后经 hooks 写入。

---

## 2. 数据结构设计

### 2.1 实体总览

| 需求中的实体 | 本项目落位 | 说明 |
|---|---|---|
| `User` | `UserProfile` | 单用户，本地存储；含 onboarding 自评 |
| `TrainingSkill` | `TrainingSkill` | 六艺各一条，保存当前状态 |
| `Exercise` | **复用现有 `ResolvedMove`** | 不新建表；通过 `artSlug + stepNo` 关联 |
| `WorkoutSession` | `WorkoutSession` | 一次训练 |
| `WorkoutExercise` | `WorkoutExercise` | 该次训练中的一项（主/辅） |
| `WorkoutSet` | `WorkoutSet` | 单组目标与实际 |
| `TrainingFeedback` | `TrainingFeedback` | 训练后的主观反馈 |
| `ProgressionRule` | `ProgressionRule` + `PROGRESSION_DEFAULT` | 可按 Step 覆写 |

### 2.2 类型定义

```ts
// ---------- 基础 ----------
export type ArtSlug =
  | 'pushups' | 'squats' | 'pullups'
  | 'leg-raises' | 'bridges' | 'handstand-pushups';

/** 计量方式：次数型 / 保持型（倒立撑全系为「保持 N 秒」） */
export type MetricKind = 'reps' | 'hold';

export type FatigueScore = 1 | 2 | 3 | 4 | 5;   // 1 状态很好 → 5 很累

// ---------- 用户与六艺状态 ----------
export interface UserProfile {
  id: string;
  createdAt: string;
  onboarding: {
    daysPerWeek: 2 | 3 | 4 | 5 | 6;      // 每周大概练几天（仅用于估算「计划需求」，不生成固定周表）
    sessionMinutes: 15 | 30 | 45 | 60;   // 每次通常多少时间（作为默认值）
    level: 'new' | 'some' | 'trained';   // 自评水平，仅用于冷启动预设
    selfReport: Partial<Record<ArtSlug, { step: number; maxReps?: number }>>;
  };
}

export type SkillStatus = 'not_started' | 'active' | 'stalled' | 'mastered';

export interface TrainingSkill {
  slug: ArtSlug;
  currentStep: number;              // 1–10；> 10 表示该艺已全部完成
  stepStartedAt: string | null;
  volumeTier: number;               // 训练量档下标，指向 volumeLadder[tier]
  lastTrainedAt: string | null;     // ISO 时间
  lastTrainedStep: number | null;
  /** 最近若干次训练的摘要（倒序，长度上限 config.historyWindow） */
  recentSessions: SessionSummary[];
  /** 最近一次训练的疲劳评分（原始值，疲劳衰减由 snapshot 计算） */
  lastFatigue: FatigueScore | null;
  /** 连续达标 / 连续失败计数（晋级与停滞判定用） */
  consecutiveEasy: number;
  consecutiveFail: number;
  /** 临时降量标记：完成度异常低后，下次该艺训练量降一档（一次性） */
  softDowngrade: boolean;
  /** 用户锁定的排除（长期，非当天） */
  excluded: boolean;
  note?: string;
}

export interface SessionSummary {
  sessionId: string;
  date: string;                     // 'YYYY-MM-DD'
  stepNo: number;
  volumeTier: number;
  metric: MetricKind;
  plannedTotal: number;             // Σ 目标（reps 或秒）
  actualTotal: number;              // Σ 实际
  completionRatio: number;          // actualTotal / plannedTotal
  fatigue: FatigueScore | null;
  aborted: boolean;
}

// ---------- 训练记录 ----------
export type SessionState = 'planned' | 'in_progress' | 'done' | 'skipped';

export interface WorkoutSession {
  id: string;
  date: string;
  generatedAt: string;
  endedAt: string | null;
  availableMinutes: 15 | 30 | 45 | 60;
  kind: 'training' | 'recovery';
  mainSkill: ArtSlug;
  exercises: WorkoutExercise[];
  state: SessionState;
  /** 生成时的快照，用于事后解释「当时为什么这么排」 */
  planSnapshot: DailyPlan;
  /** 用户对计划的主动修改 */
  appliedOptions: PlanOptions;
  revision: number;                 // 重算次数
  feedback?: TrainingFeedback;
}

export interface WorkoutExercise {
  skill: ArtSlug;
  stepNo: number;
  role: 'main' | 'assist' | 'optional';
  metric: MetricKind;
  volumeTier: number;
  order: number;
  restSeconds: number;
  sets: WorkoutSet[];
  reason: string;                   // 一句话理由（UI 直接展示）
}

export interface WorkoutSet {
  index: number;
  target: number;                   // 目标次数或秒数
  actual: number | null;            // 实际完成（null = 未记录）
  done: boolean;
}

export interface TrainingFeedback {
  sessionId: string;
  fatigue: FatigueScore;            // 必填：很累 / 正常 / 状态不错 / 状态很好
  aborted: boolean;                 // 是否中途停止
  abortReason?: 'pain' | 'time' | 'energy' | 'other';
  note?: string;
  collectedAt: string;
}

// ---------- 晋级规则（数据，可配置） ----------
export interface ProgressionRule {
  stepNo: number;
  /** 该 Step 的训练量阶梯（由 Move.trainingGoal 三档派生，此处可覆写） */
  volumeLadder: { sets: number; perSet: number }[];
  /** 晋级（Step → Step+1）条件 */
  promote: { minSessions: number; minRatio: number; maxAvgFatigue: number };
  /** 降阶建议条件 */
  demote: { failRatio: number; failSessions: number; suggestSteps: number };
}
```

### 2.3 生成产物契约（UI 只认这个）

```ts
export interface DailyPlan {
  id: string;
  date: string;
  generatedAt: string;
  revision: number;
  availableMinutes: 15 | 30 | 45 | 60;
  kind: 'training' | 'recovery';

  main: PlanItem;
  assists: PlanItem[];
  /** 加练自选池：时间有富余时用户可自行挑选（不自动加入） */
  optional: PlanItem[];

  totalEstimatedMinutes: number;
  freeMinutes: number;

  /** 一句话摘要，UI 首屏用 */
  summary: string;
  /** 结构化理由：UI 直接渲染，无需自己拼文案 */
  reasons: PlanReason[];
  /** 被排除的项目及原因（透明度） */
  excluded: { skill: ArtSlug; code: ExclusionCode; text: string }[];
  /** 六艺得分明细：折叠面板「为什么是它」用 */
  scores: Record<ArtSlug, PriorityBreakdown>;

  appliedOptions: PlanOptions;
}

export interface PlanItem {
  skill: ArtSlug;
  stepNo: number;
  nameZh: string;
  nameEn: string;
  role: 'main' | 'assist' | 'optional';
  metric: MetricKind;
  volumeTier: number;
  sets: number;
  targetPerSet: number;             // reps 或秒
  restSeconds: number;
  estimatedMinutes: number;
  reason: string;
}

export interface PlanReason {
  skill?: ArtSlug;
  code: ReasonCode;
  /** 已填好真实数值的最终文案 */
  text: string;
  /** 参与计算的真实数值，便于调试与后续 i18n */
  values: Record<string, number | string>;
}

export type ReasonCode =
  | 'RECOVERY_FULL' | 'RECOVERY_MODERATE' | 'RECOVERY_RECENT' | 'NEVER_TRAINED'
  | 'COMPLETION_HIGH' | 'COMPLETION_LOW'
  | 'FATIGUE_HIGH' | 'FATIGUE_OK'
  | 'OVERLAP_RECENT' | 'COMPLEMENT_MAIN'
  | 'FOCUS_PRIMARY' | 'STALLED'
  | 'TIME_BUDGET' | 'USER_EXCLUDE' | 'USER_ONLY' | 'PROGRESSION_READY';

export type ExclusionCode =
  | 'TRAINED_TODAY' | 'HIGH_FATIGUE' | 'STALLED' | 'USER_EXCLUDE' | 'MASTERED';

/** 用户对计划的主动修改（唯一生成入口的参数） */
export interface PlanOptions {
  availableMinutes?: 15 | 30 | 45 | 60;   // 今天的实际时间
  excludeSkills?: ArtSlug[];              // 今天不练（软排除，仅当天）
  onlySkills?: ArtSlug[];                 // 今天只想练这些
  volumeScale?: number;                   // 0.6 / 0.8 / 1.0 / 1.2 整体增减量
  avoidMain?: ArtSlug;                    // 「换一个方案」：排除当前主训后重算
  today?: string;                         // 'YYYY-MM-DD'，引擎不取系统时间
  forceKind?: 'training' | 'recovery';
}
```

### 2.4 持久化

```
localStorage['cc.profile.v1']  = UserProfile
localStorage['cc.skills.v1']   = Record<ArtSlug, TrainingSkill>
localStorage['cc.sessions.v1'] = WorkoutSession[]   // 上限 200 条，超出裁剪最旧
localStorage['cc.plan.v1']     = DailyPlan | null   // 今日计划缓存（跨刷新保留）
```

理由：与服务已用的 `useLocalStorage` 一致；纯静态站无后端；未来若上云，`TrainingSkill` 与 `WorkoutSession` 可直接映射为服务端表。

---

## 3. 六艺状态模型

`TrainingSkill` 是**存储态**，`SkillSnapshot` 是**每次生成时即时派生的计算态**。分开的原因：存储态只记事实（何时练、练了多少、什么感觉），计算态含衰减与判断，可随配置变化重算而不改历史数据。

```ts
export interface SkillSnapshot {
  slug: ArtSlug;
  order: number;                    // 原书顺序 1–6
  status: SkillStatus;
  currentStep: number;
  volumeTier: number;
  daysSinceLast: number | null;     // null = 从未训练
  hoursSinceLast: number | null;    // 用于 48h 重叠窗口的精确判断
  /** 最近 N 次加权平均完成度（权重 N, N-1, ..., 1，按可用记录归一化） */
  avgCompletion: number;
  lastCompletion: number | null;
  /** 疲劳现值（带日衰减），1–5 */
  fatigueNow: number;
  /** 与最近 48h 内已训练项目的最大重叠度 0–1 */
  overlap48h: number;
  /** 是否仍在"负荷未恢复"窗口内（用于重叠惩罚与解释文案） */
  recentlyTrainedSkills: ArtSlug[];
  /** 该 Step 的训练量阶梯 */
  ladder: { sets: number; perSet: number }[];
  metric: MetricKind;
  /** 晋级是否就绪（达到全部 promote 条件） */
  progressionReady: boolean;
  progressionHint: string | null;
}
```

### 3.1 状态判定

```ts
function deriveStatus(skill: TrainingSkill, snap: Partial<SkillSnapshot>): SkillStatus {
  if (skill.currentStep > 10) return 'mastered';
  if (skill.recentSessions.length === 0) return 'not_started';
  if (skill.consecutiveFail >= cfg.progression.demoteAfterFails) return 'stalled';
  return 'active';
}
```

### 3.2 冷启动（首次使用）

用户只回答最小集合，系统反推一切：

| 用户回答 | 系统推导 |
|---|---|
| 每周训练几天 | 仅存入 profile；**不生成固定周表**，只作为「计划需求」的参考（练得越多 → `daysPerWeek` 越大 → `focusWeight` 略降，因为每个项目被轮到的机会本来更多） |
| 每次多少时间 | 作为 `/plan` 页的默认时间档（用户每天仍可改） |
| 六艺大致水平 | 给出预设 Step：`new` → 全部 step 1；`some` → 推/腿 2、其余 1；`trained` → 推 4、腿 3、拉 3、核心 2、桥 2、倒立撑 1 |
| 每项当前 Step | 覆盖预设，逐项可改（**可跳过**，不强制） |
| 每项能完成次数（可选） | **反推 volumeTier**：在该 Step 的 `volumeLadder` 中找 `perSet ≤ 自报次数` 的最大档；找不到则取 tier 0 |

自报次数反推的伪代码：

```ts
function inferTier(ladder, maxReps?: number): number {
  if (maxReps == null) return 0;
  let tier = 0;
  for (let i = ladder.length - 1; i >= 0; i--) {
    if (ladder[i].perSet <= maxReps) { tier = i; break; }
  }
  return tier;
}
```

例：俯卧撑自报能做 12 次，第 4 式阶梯 `[1×8, 2×12, 2×25]` → `12 ≤ 12` 命中 → `tier = 1`（中级档）。

---

## 4. 今日训练生成算法

### 4.1 主流程（伪代码）

```ts
export function generateDailyPlan(
  state: TrainingState,
  options: PlanOptions,
  cfg: PlanConfig,
): DailyPlan {
  const today = options.today ?? state.today;
  const minutes = options.availableMinutes ?? state.profile.onboarding.sessionMinutes;

  // ① 派生计算态
  const snaps = allArtSlugs.map(s => snapshot(s, state, today, cfg));

  // ② 硬门控：不满足条件的直接出局（含原因）
  const { pool, excluded } = gate(snaps, options, cfg);

  // ③ 候选池为空 → 恢复日方案（优雅降级，绝不返回空计划）
  if (pool.length === 0) return buildRecoveryPlan(snaps, minutes, excluded, cfg);

  // ④ 打分并排序
  const scored = pool
    .map(s => ({ snap: s, score: priority(s, state, today, cfg) }))
    .sort((a, b) => b.score.total - a.score.total || a.snap.order - b.snap.order);

  // ⑤ 主训练 = 第一名
  const main = scored[0];

  // ⑥ 辅助训练：互补性 + 类型分散
  const assists = selectAssists(main, scored.slice(1), minutes, cfg);

  // ⑦ 套用时间预算 → 项数 / 组次 / 休息
  const plan = applyTimeBudget(main, assists, minutes, today, cfg);

  // ⑧ 估算耗时 + 生成加练池
  const timed = estimateAndFill(plan, scored, minutes, cfg);

  // ⑨ 生成解释
  return explain(timed, scored, excluded, options, cfg);
}
```

### 4.2 硬门控（第一步：排除）

| 条件 | 结果 | 代码 | 说明 |
|---|---|---|---|
| `status === 'mastered'` | 排除 | `MASTERED` | 该艺 10 式已全部完成 |
| `skill.excluded === true` | 排除 | `USER_EXCLUDE` | 用户在「我的」里长期关闭 |
| `options.excludeSkills` 含该艺 | 排除 | `USER_EXCLUDE` | 当天主动排除（只影响今天） |
| `options.onlySkills` 非空且不含该艺 | 排除 | `USER_ONLY` | 今天只想练某些 |
| `hoursSinceLast < cfg.gate.trainedTodayHours`（默认 20h） | 排除 | `TRAINED_TODAY` | 今天已经练过这个艺 |
| `fatigueNow >= 4.5 && hoursSinceLast <= 48` | 排除 | `HIGH_FATIGUE` | 上次很累且间隔太短 |
| `status === 'stalled' && hoursSinceLast <= cfg.gate.stallRestHours`（默认 48h） | 排除 | `STALLED` | 连续失败需要恢复 |

**关键设计：软门控 + 兜底**

- 门控先按上表过滤；若**过滤后候选池少于 `minPool`（默认 3）**，则按「排除优先级」逐条放回（顺序：`STALLED` → `HIGH_FATIGUE` → `TRAINED_TODAY`），直到池子 ≥ 3。理由：宁可安排一个不理想的训练，也不要给用户一个空页面。
- 放回的动作必须写入 `reasons`，文案明说"按规则本应排除，因候选不足已放回，建议降低训练量"。**透明度优先于完美**。

### 4.3 恢复日兜底方案

若池子完全为空（例如用户手动排除了全部六艺）：

- `kind = 'recovery'`，不排主训练；
- 输出一条 `PlanReason`：`今天已无合适训练项目，建议安排恢复（散步、拉伸、呼吸练习）`；
- UI 显示「今天休息」而非空白计划，并提供「仍要练点什么」按钮（把 `excludeSkills` 清空重算）。

---

## 5. Priority Score 具体计算方式

### 5.1 公式

```
priority(skill) =
      W.recovery   × recoveryNeed(skill)          // 0 – 1
    + W.completion × completionHealth(skill)      // 0 – 1.2（clamp 到 1.2 上限）
    + W.focus      × planFocus(skill)             // 0 – 1
    − W.fatigue    × fatigueLoad(skill)           // 0 – 1
    − W.overlap    × overlapWithRecent(skill)     // 0 – 1
    − W.stall      × stallFlag(skill)             // 0 或 1
```

**加分项 3 个、扣分项 3 个，一一对应需求第三节的因子清单。** 全部因子先归一化到 `0–1` 再加权，因此权重之间的量级可以直接比较、可以调。

### 5.2 默认权重（可配置）

| 参数 | 默认值 | 含义与调参直觉 |
|---|---|---|
| `W.recovery` | `0.35` | 最高权重：**恢复缺失度**。调大 → 更偏向"该练了"的项目 |
| `W.completion` | `0.20` | 完成度健康度。调大 → 更偏向"做得顺"的项目 |
| `W.focus` | `0.25` | 推进链权重。调大 → 更坚守"一门一门推进"的原书方法论 |
| `W.fatigue` | `0.30` | 疲劳惩罚。调大 → 更保守，累了就换别的 |
| `W.overlap` | `0.25` | 类型重叠惩罚。调大 → 更不允许连着练同一负荷类型 |
| `W.stall` | `0.15` | 停滞惩罚。调大 → 连续失败的项目更快被雪藏 |

### 5.3 各因子的定义

**① recoveryNeed（恢复缺失度）**

```
daysSince = daysBetween(lastTrainedAt, today)
recoveryNeed =
    1.0                                   若 lastTrainedAt === null（从未训练）
    clamp((daysSince − FLOOR) / (FULL − FLOOR), 0, 1)   否则
FLOOR = cfg.recovery.floorDays  (默认 1)   // 刚练过的第二天，不算"缺失"
FULL  = cfg.recovery.fullDays   (默认 5)   // 5 天后视为完全恢复，给满分
```

曲线效果：0 天 → 0；1 天 → 0；3 天 → 0.50；5 天及以上 → 1.00（此后不再增长，避免"越久不练越该练"导致荒废项目长期霸榜）。

**② completionHealth（完成度健康度）**

```
avgCompletion = 加权平均（最近 N=3 次，权重 3/2/1，按可用记录归一化）
              若完全无记录 → cfg.completion.noHistoryDefault (默认 0.75)
completionHealth = clamp(avgCompletion, 0, 1.2) / 1.2      // 归一到 0–1
```

除以 `1.2` 是为了容忍"超额完成"（用户主动加练）不产生畸形高分。无记录时给 0.75 是为了**中性**——既不奖励也不惩罚一个还没练过的项目。

**③ planFocus（推进链权重）**

先确定 `primaryArt`：按原书顺序，**第一个 `status !== 'mastered'` 的艺**。

```
planFocus =
    1.00  若 skill === primaryArt                    // 主力推进对象
    0.55  若 status !== 'mastered'                   // 其他待推进
    0.25  若 status === 'mastered'（实际已被门控排除）
（可调：cfg.focus.primary / others）
```

这一项是**原书方法论「一门一门推进，不贪多」的载体**。调高 `W.focus` 或 `focus.primary`，系统就更死守主练艺。

**④ fatigueLoad（疲劳负荷）**

疲劳必须**随时间衰减**，否则"上周很累"会一直罚到今天：

```
fatigueDecayed = NEUTRAL + (lastFatigue − NEUTRAL) × DECAY ^ daysSince
                 NEUTRAL = 3（中性），DECAY = 0.6（每天衰减 40%）
fatigueLoad    = clamp((fatigueDecayed − NEUTRAL) / (5 − NEUTRAL), 0, 1)
```

| 记录疲劳 | 当天 | 1 天后 | 2 天后 | 3 天后 |
|---|---|---|---|---|
| 5（很累） | 1.00 | 0.60 | 0.36 | 0.22 |
| 4 | 0.50 | 0.30 | 0.18 | 0.11 |
| 3 及以下 | 0 | 0 | 0 | 0 |

**⑤ overlapWithRecent（类型重叠）**

```
lookback = cfg.overlap.lookbackHours (默认 48)
recentSkills = 最近 lookback 小时内训练过的艺（含今天）
overlapWithRecent(s) = max( MATRIX[r][s] for r in recentSkills )     // 含 r === s（自己）
```

注意 `r === s` 时矩阵值为 `1.0`，因此**昨天练过的项目今天会被扣满分项**——这正是需求里"俯卧撑昨天刚练所以降低优先级"的实现方式，且是**同一套公式自然得出的**，不是特例判断。

**⑥ stallFlag（停滞）**

```
stallFlag = status === 'stalled' ? 1 : 0
```

`stalled` 时同时被门控在 48h 内排除，因此这一项是"放回场景"下的额外保险。

### 5.4 完整得分示例（真实数据见 §10）

以「深蹲」为例（`§10` 数据，`today = 2026-09-30`）：

| 因子 | 归一化值 | 权重 | 贡献 |
|---|---|---|---|
| recoveryNeed | 1.000（7 天未练，已封顶） | 0.35 | **+0.3500** |
| completionHealth | 0.800（完成度 0.960 ÷ 1.2） | 0.20 | **+0.1600** |
| planFocus | 0.55（非主练艺） | 0.25 | **+0.1375** |
| fatigueLoad | 0（上次疲劳 3 = 中性） | 0.30 | −0.0000 |
| overlapWithRecent | 0.10（48h 内练过俯卧撑） | 0.25 | **−0.0250** |
| stallFlag | 0 | 0.15 | −0.0000 |
| **总分** | | | **0.6225** |

同样条件下「俯卧撑」：`0.35×0 + 0.20×0.776 + 0.25×1.00 − 0.30×0.300 − 0.25×1.00 = 0.0652`。

差距 0.62 vs 0.07，来源完全可追溯到两条事实：**俯卧撑昨天刚练（重叠扣 0.25）+ 上次很累（疲劳扣 0.09）**。这就是"可解释"的含义。

> ⚠️ `completionHealth` 是**归一化后**的值（`clamp(avg,0,1.2)/1.2`），不是原始完成度。计算时容易漏掉这一步，务必以公式为准。

### 5.5 可解释性保障

`PriorityBreakdown` 会随计划一起返回，UI 的「为什么是它？」折叠面板直接渲染：

```ts
export interface PriorityBreakdown {
  total: number;
  factors: {
    key: 'recovery' | 'completion' | 'focus' | 'fatigue' | 'overlap' | 'stall';
    raw: number;                  // 归一化后的因子值
    weight: number;
    contribution: number;         // raw × weight（带符号）
    text: string;                 // 「5 天没有训练，恢复充分」/「昨天刚训练，扣分」
  }[];
}
```

---

## 6. 恢复 / 疲劳 / 完成度的判断规则

### 6.1 恢复

| 距上次训练 | recoveryNeed | 系统行为 |
|---|---|---|
| < 20 小时 | — | **硬排除**（`TRAINED_TODAY`） |
| 1 天 | 0.00 | 优先级最低，但不禁 |
| 2–3 天 | 0.25–0.50 | 正常 |
| 3–5 天 | 0.50–1.00 | 提高优先级 |
| ≥ 5 天 | 1.00 | 满分，进入优先队列 |
| 从未训练 | 1.00 | 满分，由 `planFocus` 决定先后 |

**不规定"必须休息 X 天"**——恢复时间只作为一项加分因子参与评分，是否真的排进今天由总分决定。

### 6.2 完成度

```
completionRatio = Σ actual / Σ target
```
- 次数型：`Σ 实际次数 / Σ 目标次数`
- 保持型：`Σ 实际秒数 / Σ 目标秒数`

### 6.3 疲劳

- 采集方式：训练结束后 1 次单击（4 档按钮：状态很好 / 状态不错 / 正常 / 很累 → 映射 1 / 2 / 3 / 5）。
- 未评分时：默认 `neutral = 3`，不参与加减分。
- 用途：① 影响优先级（`fatigueLoad`）；② 影响晋级判定（`promote.maxAvgFatigue`）；③ 影响当天项数上限（见 §7.3）。

### 6.4 阈值总表（全部可配置）

| 参数 | 默认 | 用途 |
|---|---|---|
| `failRatio` | `0.70` | 低于此值算「未完成」 |
| `hardFailRatio` | `0.60` | 低于此值算「明显失败」，进入降量/降阶链路 |
| `easyRatio` | `1.00` | 达到且疲劳 ≤ 3 算「轻松完成」 |
| `historyWindow` | `3` | 计算平均完成度取最近几次 |
| `fatigue.neutral` | `3` | 疲劳中性点 |
| `fatigue.decayPerDay` | `0.6` | 疲劳日衰减系数 |
| `recovery.floorDays` | `1` | 恢复缺失度起点 |
| `recovery.fullDays` | `5` | 恢复缺失度满分点 |
| `overlap.lookbackHours` | `48` | 类型重叠回溯窗口 |
| `gate.trainedTodayHours` | `20` | 当天已练的排除阈值 |
| `gate.stallRestHours` | `48` | 停滞项目强制休息窗口 |

---

## 7. 主训练与辅助训练的选择规则

### 7.1 主训练

```
main = argmax(priority(s))       // 同分 → 取 artOrder 更小者（原书顺序）
```

优先选中的项目天然满足需求描述的四个特征：恢复充分（`recoveryNeed` 高）、长时间没练、完成情况正常（`completionHealth` 高）、推进链需要（`planFocus` 高）；而刚练过的（`overlap` 含自身）、很累的（`fatigue`）会被自然压低。

### 7.2 辅助训练（互补 + 分散，两道约束）

**第一步：算辅助分**（三个成分，避免"全排推类"）

```
assistScore(s) =
      W.assist.score      × priority(s)                 // 0.50  本身就该练
    + W.assist.complement × (1 − MATRIX[main][s])       // 0.30  与主训互补
    − W.assist.freshness  × overlap48h(s)               // 0.20  48h 内已练过的负荷别再叠加
```

**第二步：硬约束过滤**（从高到低遍历，不满足就跳过取下一个）

| 约束 | 默认值 | 目的 |
|---|---|---|
| 与主训的重叠 ≤ 上限 | `overlap.maxWithMain = 0.60` | 禁止「俯卧撑 + 倒立撑」这类双推组合 |
| 与已入选辅助项目的两两重叠 ≤ 上限 | `overlap.maxBetweenAssists = 0.60` | 防止三个辅助互相重叠 |
| 不可与主训同艺 | — | 同一艺不重复出现 |

**第三步：按时间预算截取数量**（见 §7.4）。

示例对比（真实计算见 §10.2）：

| 方案 | 结果 | 判定 |
|---|---|---|
| ❌ 被约束拦下 | 主训俯卧撑 + 辅助倒立撑（重叠 0.60）+ 另一推类 | 双推，超上限 |
| ✅ 正常产出 | 主训桥 + 辅助深蹲（0.40）+ 举腿（0.50）+ 引体（0.35） | 后链 + 下肢 + 核心 + 拉，互补良好 |

### 7.3 疲劳对项数的抑制

```
avgFatigue = 六艺 fatigueNow 的平均
maxItemsAdjust = avgFatigue >= 4.0 ? −1 : 0
最终项数 = clamp(时间档 maxItems + maxItemsAdjust, 1, 5)
```

整体状态很差时自动少排一项——这是"当天状态影响当天计划"的落地方式。

### 7.4 时间预算映射（第六节需求）

| 时间 | 最大项目数 | 主训量偏移 | 主训休息 | 辅助组数上限 | 加练池 |
|---|---|---|---|---|---|
| 15 min | 2（1 主 + 1 辅） | 0 | 60 s | 1 组 | 关闭 |
| 30 min | 3（1 主 + 2 辅） | 0 | 75 s | 2 组 | 开启 |
| 45 min | 4（1 主 + 3 辅） | 0 | 90 s | 2 组 | 开启 |
| 60 min | 5（1 主 + 4 辅） | +1（需满足轻松条件，否则 0） | 120 s | 2 组 | 开启 |

`主训量偏移 = +1` 的额外条件：该技能满足 `easyRatio`（最近完成度 ≥ 1.0 且疲劳 ≤ 3），否则恒为 `0`。这样"时间更长 → 增加训练组数"是有条件的，而不是无脑加量（符合"不练到力竭"）。

`volumeScale`（用户点「减少训练量 / 增加训练量」）：`0.6 / 0.8 / 1.0 / 1.2`，作用于**组数**（`sets = max(1, round(sets × scale))`），不作用于单组次数（次数由阶梯决定，不轻易动）。

### 7.5 耗时估算

```
每项耗时 = prepSeconds(60)
         + Σ over sets [ perSet × secondsPerRep(负荷类型) ] 
         + restSeconds × (sets − 1)
```

| 负荷类型 | secondsPerRep | 说明 |
|---|---|---|
| 水平推 / 垂直推 | 4 s | 含离心控制 |
| 垂直拉 | 5 s | 含下放控制 |
| 下肢 | 3 s | 节奏快 |
| 核心 / 后链 | 4 s | 保持型直接取秒数 |

### 7.6 时间有富余时：加练自选池（**重要设计取舍**）

按真实数据估算，一个 45 分钟档的计划实际只占约 **15 分钟**（例：2×20 + 2×15 + 1×10 + 2×11，含组间休息）。

这不是 bug，而是**原书训练量本身就是短时段、低组数、不练到力竭**（原书明确反对超量与力竭训练）。因此本系统的立场是：

> **时间预算是「上限」和「节奏控制器」，不是要填满的容器。**

具体处理：

1. 计划卡显式打印「预计 15 分钟 / 你有 45 分钟」，并提示「剩余时间建议用于热身（5 分钟）与拉伸（10 分钟）」；
2. 把候选池里得分靠后但**互补性合格**的 1–2 个项目放进 `optional`（UI 标为「加练自选」），**不自动加入**，由用户点选；
3. 若用户连续选择加练，说明其实际承受能力高于原书低阶标准，`volumeTier` 的晋级会更快（连续轻松完成 → tier 提升），系统会自己长大，而不需要一开始就排满。

这条取舍必须写进产品说明，否则用户会觉得"45 分钟怎么只安排了 4 个动作"。

### 7.7 训练顺序

主训在前（体力最好时做最难的动作），辅助按**辅助分降序**排列。

> 【实施修正】早期草稿写的是「辅助按与主训的重叠升序」，但辅助分本身已经含 0.3 权重的互补性，
> 两者在多数情况下同序、在个别情况下不同序（§10.8 排除引体后：重叠升序为「倒立撑 → 举腿 → 桥」，
> 辅助分降序为「举腿 → 桥 → 倒立撑」）。**实现取辅助分降序**，理由是它与「选谁」用的是同一个指标，
> 排序与选择一致才讲得通；`§10.6` 与 `§10.8` 的表格也就是这个顺序。

---

## 8. Progression / 晋级规则

### 8.1 两个维度严格分离

| 维度 | 载体 | 变化路径 |
|---|---|---|
| **动作难度** | `currentStep` 1–10 | 基础 → 进阶 → 高阶；**需要用户确认才变** |
| **训练量** | `volumeTier` 0–2，指向 `volumeLadder` | 初级 → 中级 → 升阶；**同 Step 内先加量** |

例：俯卧撑第 4 式半俯卧撑的阶梯是 `[1组×8, 2组×12, 2组×25]`。用户从 `tier 0` 起步，练到能完成 `2组×25`（即达到 `progressionStandard` 的数值）且质量验收通过，**才**进入「可以试试第 5 式标准俯卧撑」的状态。难度从不因为"练了几次"自动上升。

### 8.2 状态机

```
                    ┌──────────────────────────────────────┐
                    │ 连续 easySessions 次轻松完成当前档     │
                    ▼                                      │
  volumeTier 0 ──► volumeTier 1 ──► volumeTier 2 ──► progressionReady
       ▲                ▲                │                  │
       │                │                │            用户确认「进入下一式」
       │   完成度 < 0.60 连续 2 次        │                  ▼
       └────────────────┴────────────────┘          Step + 1, tier = 0
                                              （若新 Step 更简单需重新爬量）
  ─────────────────────────────────────────────────────────────
  连续 3 次完成度 < 0.60 → status = 'stalled'
                        → 建议降回 Step − 1（仅建议，用户确认）
                        → 48h 内不再被选为主训
```

### 8.3 规则表（可配置 + 可按 Step 覆写）

```ts
export const PROGRESSION_DEFAULT = {
  // 训练量档提升（同 Step 内加量）
  tierUp:  { easySessions: 2, minRatio: 1.00, maxAvgFatigue: 3.0 },

  // Step 晋级（难度提升）—— 需 tier 已达阶梯最高档
  promote: { minSessions: 2, minRatio: 1.00, maxAvgFatigue: 3.5, nearMissTolerance: 0.05 },

  // 维持区间
  hold:    { minRatio: 0.80 },

  // 临时降量（一次性，不写回 tier）
  softDown: { ratio: 0.70 },

  // 正式降量
  tierDown: { ratio: 0.60, sessions: 2 },

  // 停滞与降阶建议
  stall:   { ratio: 0.60, sessions: 3, suggestSteps: 1 },
};

/** 按难度分档的保守化覆写：越靠后越谨慎 */
export const STEP_ADJUSTMENTS = {
  highStepFrom: 7,                 // 第 7 式起
  promote: { minSessions: 3, maxAvgFatigue: 3.0 },
  stall:   { sessions: 2 },        // 更快识别停滞
};
```

### 8.4 四条判定（每次训练结束后计算）

```
每次训练结束 → 算 completionRatio + 记录 fatigue →

① 轻松完成（ratio ≥ 1.00 且 fatigue ≤ 3）
   easyRun + 1；failRun = 0
   若 easyRun ≥ tierUp.easySessions 且 fatigue 均值 ≤ tierUp.maxAvgFatigue
     → 提议 tier + 1（UI 显示「下次试试 2 组 × 12 次」，用户点确认）

② 正常完成（0.80 ≤ ratio < 1.00）
   easyRun = 0；failRun = 0；量不变

③ 未完成（0.70 ≤ ratio < 0.80）
   easyRun = 0；failRun 不变；本次不计入晋级推进

④ 明显失败（ratio < 0.60）
   easyRun = 0；failRun + 1；softDowngrade = true（下次该艺训练量降一档）
   若 failRun ≥ stall.sessions
     → status = 'stalled'，提议「降回第 N−1 式巩固」（用户确认）
```

### 8.5 晋级就绪的判定（用于生成计划时提示）

```ts
function isProgressionReady(snap, state, cfg): boolean {
  const p = cfg.progression.promote;
  const last = snap.recentSessions.slice(-p.minSessions);
  if (last.length < p.minSessions) return false;
  if (snap.volumeTier < snap.ladder.length - 1) return false;   // 量还没爬满
  const allOk = last.every(s =>
    s.completionRatio >= p.minRatio - p.nearMissTolerance &&
    s.volumeTier === snap.ladder.length - 1);
  const fatigueOk = avg(last.map(s => s.fatigue ?? 3)) <= p.maxAvgFatigue;
  return allOk && fatigueOk;
}
```

**关键：`progressionReady` 只产生「建议」，绝不自动改 `currentStep`。** 需求原文"不要每次训练都自动升级"由此保证。

### 8.6 晋级提示的安全附加

若下一式带 `riskNote`（桥全系 / 倒立撑全系 / 各艺 8–10 式），晋级卡片上**强制**附带安全提示与「先看动作要领」入口（跳转该式详情页）。这是本项目既有的安全约束（PRD P0-7），不能因为加了计划功能而绕过。

---

## 9. 用户主动修改计划后的重新计算逻辑

### 9.1 唯一入口

所有修改都转化为 `PlanOptions` 后调用 `generateDailyPlan`，并 `revision + 1`：

| 用户操作 | Options 变化 | 结果保证 |
|---|---|---|
| 今天不想练 X | `excludeSkills = [...prev, X]` | X 从候选池移除；其余项目**重新打分**，不会随机换 |
| 换一个方案 | `avoidMain = 当前 main` | 当前主训被排除，取分数次高者为主训（**确定性**） |
| 减少训练量 | `volumeScale = 0.6`（或 0.8） | 组数按比例缩减，主训项数不变 |
| 增加训练量 | `volumeScale = 1.2` | 组数增加，但仍受 `maxItems` 与阶梯上限约束 |
| 今天只想练某类 | `onlySkills = ['pushups','leg-raises']` | 白名单过滤后重算 |
| 改时间 | `availableMinutes = 15` | 项数 / 休息 / 组数上限整体重算 |

### 9.2 重算的稳定性要求

- **确定性**：同 `state` + 同 `options` → 必然同结果（无 `Math.random`）。可单测、可回放。
- **修改可撤销**：「重置今天的调整」= 清空 `appliedOptions` 后重算，回到初始计划。
- **不污染长期状态**：当天的排除、加减量**只作用于当天 Session**，不写回 `TrainingSkill`。（长期排除走 `skill.excluded`，在「我的」里单独开关。）
- **保留解释**：重算后 `reasons` 必须包含一条 `USER_EXCLUDE` / `TIME_BUDGET` 记录，说明"因为你的调整，计划变成了这样"。
- **连续换方案的保护**：若 `avoidMain` 累积导致候选少于 2，则停止换方案并提示「今天可选项目只剩 N 个，已恢复完整候选池」。

### 9.3 伪代码

```ts
export function replan(
  state: TrainingState,
  current: DailyPlan,
  patch: Partial<PlanOptions>,
  cfg: PlanConfig,
): DailyPlan {
  const next: PlanOptions = { ...current.appliedOptions, ...patch };
  if (patch.avoidMain) {
    next.excludeSkills = [...(next.excludeSkills ?? []), patch.avoidMain];
    delete next.avoidMain;
  }
  const plan = generateDailyPlan(state, next, cfg);
  return { ...plan, revision: current.revision + 1 };
}
```

---

## 10. 模拟数据与完整推演

### 10.1 输入数据

**用户**：每周 4 天 / 每次 45 分钟 / 自评初级
**今天**：`2026-09-30`（周三）

**六艺状态**

| 艺 | 当前 Step | 动作名 | 训练量阶梯（来自 `trainingGoal`） | 当前 tier | 上次训练 | 上次疲劳 |
|---|---|---|---|---|---|---|
| ① 俯卧撑 | 4 | 半俯卧撑 | 1×8 / **2×12** / 2×25 | 1 | 09-29（1 天前） | 4（很累） |
| ② 深蹲 | 3 | 支撑深蹲 | 1×10 / **2×15** / 3×30 | 1 | 09-23（7 天前） | 3 |
| ③ 引体向上 | 4 | 半引体向上 | 1×8 / **2×11** / 2×15 | 1 | 09-27（3 天前） | 3 |
| ④ 举腿 | 2 | 平卧抬膝 | 1×10 / 2×20 / 3×35 | 0 | **从未训练** | — |
| ⑤ 桥 | 2 | 直桥 | 1×10 / **2×20** / 3×40 | 1 | 09-25（5 天前） | 2 |
| ⑥ 倒立撑 | 1 | 靠墙顶立 | 保持 30s / 1min / 2min（hold） | 0 | **从未训练** | — |

**训练历史明细**

| 日期 | 艺 | Step | tier | 计划总量 | 实际完成 | 完成度 | 疲劳 |
|---|---|---|---|---|---|---|---|
| 09-29 | 俯卧撑 | 4 | 1 | 2×12 = 24 | 12 / 10 = 22 | **91.7%** | 4 |
| 09-26 | 俯卧撑 | 4 | 1 | 24 | 24 | 100% | 3 |
| 09-23 | 俯卧撑 | 4 | 1 | 24 | 20 | 83.3% | 3 |
| 09-27 | 引体向上 | 4 | 1 | 2×11 = 22 | 22 | 100% | 3 |
| 09-24 | 引体向上 | 4 | 1 | 22 | 22 | 100% | 3 |
| 09-21 | 引体向上 | 4 | 1 | 22 | 18 | 81.8% | 3 |
| 09-25 | 桥 | 2 | 1 | 2×20 = 40 | 40 | 100% | 2 |
| 09-19 | 桥 | 2 | 0 | 10 | 10 | 100% | 2 |
| 09-23 | 深蹲 | 3 | 1 | 2×15 = 30 | 28 | 93.3% | 3 |
| 09-20 | 深蹲 | 3 | 0 | 10 | 10 | 100% | 2 |

### 10.2 第①步：派生快照

| 艺 | daysSince | avgCompletion（加权） | fatigueNow | overlap48h | status | progressionReady |
|---|---|---|---|---|---|---|
| 俯卧撑 | 1 | (3×0.917+2×1.0+1×0.833)/6 = **0.931** | 3+1×0.6 = **3.60** | 1.00（自己） | active | ✗（tier 1 ≠ 最高档） |
| 深蹲 | 7 | (3×0.933+2×1.0)/5 = **0.960** | 3.00 | 0.10（俯卧撑） | active | ✗ |
| 引体向上 | 3 | (3×1.0+2×1.0+1×0.818)/6 = **0.970** | 3.00 | 0.10（俯卧撑） | active | ✗ |
| 举腿 | ∞（未训练） | 0.75（无历史默认） | 3.00 | 0.10（俯卧撑） | not_started | ✗ |
| 桥 | 5 | (3×1.0+2×1.0)/5 = **1.000** | 3+(2−3)×0.6⁵ = **2.92** | 0.20（俯卧撑） | active | ✗（tier 1 ≠ 最高档） |
| 倒立撑 | ∞（未训练） | 0.75（无历史默认） | 3.00 | 0.60（俯卧撑） | not_started | ✗ |

> 注 1：`overlap48h` 只看 48 小时窗口（09-28 起），落在窗口内的只有 **09-29 的俯卧撑**。取值 = `max(矩阵[俯卧撑][该艺])`，因此俯卧撑自己 1.00、倒立撑 0.60、桥 0.20，其余 0.10。
>
> 注 2：桥的 `fatigueNow` 是 `3 + (2 − 3) × 0.6⁵ = 2.92`（**带了日衰减**；早期草稿误写为原始的 2.00）。因为 `fatigueLoad` 对低于中性点的值一律记 0 分惩罚，这个差异**不影响任何得分**，但公式必须写对，否则以后调 `decayPerDay` 就会算出错的结果。同理，§7.3 用来抑制项数的「六艺疲劳均值」也用衰减后的现值：`(3.60+3.00+3.00+3.00+2.92+3.00)/6 ≈ 3.09 < 4.0` → 今天不减项。这一点已被 `src/lib/plan/plan.test.ts` 断言固定。

### 10.3 第②步：硬门控

逐条检查，**今天没有任何项目被硬排除**：

| 艺 | 检查结果 |
|---|---|
| 俯卧撑 | 距上次 1 天 > 20 小时 → 不触发 `TRAINED_TODAY`；疲劳 3.6 < 4.5 → 通过 |
| 深蹲 / 引体 / 举腿 / 桥 / 倒立撑 | 均无触发 |

候选池 = **全部六艺**。（这是好事：说明"昨天练过"是通过**打分**体现的，而不是靠硬规则一刀切。）

### 10.4 第③步：优先级打分

`completionHealth` 为归一化值（`clamp(avg,0,1.2)/1.2`）。

| 艺 | recovery<br>×0.35 | completion<br>×0.20 | focus<br>×0.25 | fatigue<br>×−0.30 | overlap<br>×−0.25 | stall | **总分** | 排名 |
|---|---|---|---|---|---|---|---|---|
| **深蹲** | 1.000 → **+0.3500** | 0.800 → **+0.1600** | 0.55 → **+0.1375** | 0 → −0.0000 | 0.10 → **−0.0250** | 0 | **0.6225** | **1** |
| 桥 | 1.000 → +0.3500 | 0.833 → +0.1667 | 0.55 → +0.1375 | 0 | 0.20 → −0.0500 | 0 | **0.6042** | 2 |
| 举腿 | 1.000 → +0.3500 | 0.625 → +0.1250 | 0.55 → +0.1375 | 0 | 0.10 → −0.0250 | 0 | **0.5875** | 3 |
| 倒立撑 | 1.000 → +0.3500 | 0.625 → +0.1250 | 0.55 → +0.1375 | 0 | **0.60 → −0.1500** | 0 | **0.4625** | 4 |
| 引体向上 | 0.500 → +0.1750 | 0.808 → +0.1617 | 0.55 → +0.1375 | 0 | 0.10 → −0.0250 | 0 | **0.4492** | 5 |
| 俯卧撑 | **0.000** → +0.0000 | 0.776 → +0.1552 | **1.00 → +0.2500** | **0.300 → −0.0900** | **1.00 → −0.2500** | 0 | **0.0652** | 6 |

**读得出来的结论**：

- 俯卧撑虽然是**主练艺（focus = 1.00，单项最高）**，但因为*昨天刚练完*（重叠 −0.25）*且很累*（疲劳 −0.09），总分垫底 → **今天不练它**。这正是需求里要的行为，且不是靠 `if (昨天练过) 跳过` 这种特例写出来的。
- 深蹲与桥几乎并驾齐驱（0.6225 / 0.6042），差距只来自**重叠**（俯卧撑 vs 深蹲 0.10，vs 桥 0.20）——虽然桥的完成度更高（0.833 vs 0.800），但被重叠多扣的 0.025 反超。
- 倒立撑本该很"久没练"（recovery 满分），却被**推类重叠 0.60** 扣掉 0.15，落到第 4 —— 这就是"六艺不是六个独立动作"的直接体现。

### 10.5 第④⑤步：主训 + 辅助

**主训练 = 深蹲**（第 3 式 支撑深蹲）

**辅助打分**（`0.5×priority + 0.3×(1−矩阵[深蹲][s]) − 0.2×overlap48h`）：

| 辅助候选 | priority | 互补<br>1−矩阵 | overlap48h | assistScore | 排名 | 与主训重叠 |
|---|---|---|---|---|---|---|
| 举腿 | 0.5875 | 1−0.20 = 0.80 | 0.10 | **0.5137** | **1** | 0.20 ✓ |
| 引体向上 | 0.4492 | 1−0.20 = 0.80 | 0.10 | **0.4446** | **2** | 0.20 ✓ |
| 桥 | 0.6042 | 1−0.40 = 0.60 | 0.20 | **0.4421** | **3** | 0.40 ✓ |
| 倒立撑 | 0.4625 | 1−0.10 = 0.90 | 0.60 | 0.3812 | 4 | 0.10 ✓（但 freshness 罚 0.12） |
| 俯卧撑 | 0.0652 | 1−0.10 = 0.90 | 1.00 | 0.1026 | 5 | 0.10 ✓（freshness 罚 0.20） |

45 分钟 → 取前 3 个辅助：**举腿、引体向上、桥**。
两两分散约束全部通过：举腿↔引体 0.30、举腿↔桥 0.50、引体↔桥 0.35，均 ≤ 0.60。

> 注意「桥」的 `priority`（0.6042）比「举腿」（0.5875）**高**，但作为辅助排在举腿之后——因为辅助分里互补性占 0.3 权重，桥与主训深蹲的重叠 0.40 拖累了它。这说明**主训用优先级、辅助用互补性**的双标准是生效的，不是摆设。

### 10.6 第⑥⑦步：套用时间预算与耗时估算

45 分钟档：`restSeconds = 90`（辅助 75）、`assistSetCap = 2`、`maxItems = 4`

| 顺序 | 角色 | 项目 | 组 × 次 | 休息 | 耗时计算 | 预估 |
|---|---|---|---|---|---|---|
| 1 | **主训** | 深蹲 · 支撑深蹲 | 2 组 × 15 次 | 90 s | 60 + 45 + 90 + 45 | **4.0 min** |
| 2 | 辅助 | 举腿 · 平卧抬膝 | 1 组 × 10 次 | 75 s | 60 + 40 | **1.7 min** |
| 3 | 辅助 | 引体向上 · 半引体向上 | 2 组 × 11 次 | 75 s | 60 + 55 + 75 + 55 | **4.1 min** |
| 4 | 辅助 | 桥 · 直桥 | 2 组 × 20 次 | 75 s | 60 + 80 + 75 + 80 | **4.9 min** |
| | | | | | **合计** | **14.7 min** |

剩余 `45 − 14.7 ≈ 30 分钟` → 按 §7.6 处理：提示热身 + 拉伸，并提供加练自选池（倒立撑、俯卧撑，各标为 `optional`，**不自动加入**）。

### 10.7 第⑧步：最终计划 + 动态解释

```
┌───────────────────────────────────────────────────────────┐
│ 今日训练计划         2026-09-30 周三      预计 15 分钟       │
│ 你有 45 分钟 · 剩余约 30 分钟建议用于热身与拉伸              │
├───────────────────────────────────────────────────────────┤
│ ▍主训练                                                    │
│  ① 深蹲 · 第 3 式 支撑深蹲      2 组 × 15 次     休息 90s   │
│     下肢 · 训练量档：中级                                  │
│     「深蹲已经 7 天没有训练，恢复充分；最近完成度稳定        │
│       （96%），因此作为今天的主要训练。」                    │
├───────────────────────────────────────────────────────────┤
│ ▍辅助训练                                                  │
│  ② 举腿 · 第 2 式 平卧抬膝      1 组 × 10 次     休息 75s   │
│     「举腿尚未开始训练，首次安排 1 组 × 10 次（初级标准）；  │
│       与主训练（深蹲）负荷重叠仅 0.20，互补良好。」         │
│  ③ 引体向上 · 第 4 式 半引体向上 2 组 × 11 次    休息 75s   │
│     「引体向上已经 3 天没有训练，完成度稳定（97%），         │
│       与主训练重叠 0.20，作为辅助训练。」                   │
│  ④ 桥 · 第 2 式 直桥            2 组 × 20 次     休息 75s   │
│     「桥已经 5 天没有训练，近 2 次完成度均为 100%；          │
│       虽与深蹲在伸髋动作上有部分重叠（0.40），仍有余量。」   │
├───────────────────────────────────────────────────────────┤
│ ▍今天没有安排                                              │
│  · 俯卧撑：昨天刚完成训练，且当时自觉很累（4/5），          │
│            恢复不足，今天降低优先级。                       │
│  · 倒立撑：最近 48 小时内练过俯卧撑（水平推），与倒立撑      │
│            （垂直推）负荷重叠 60%，今天暂不叠加推类训练。   │
├───────────────────────────────────────────────────────────┤
│ ▍加练自选（可选）                                          │
│  + 倒立撑 · 靠墙顶立（保持 30 秒）                          │
│  + 俯卧撑 · 半俯卧撑（2 组 × 12 次）                        │
├───────────────────────────────────────────────────────────┤
│ ▍训练提示                                                  │
│  · 不练到力竭，每式达标即止                                 │
│  · 深蹲组间休息 90 秒，其余 75 秒                            │
│  · 桥属后链动作，量力而行，避免腰部代偿                      │
└───────────────────────────────────────────────────────────┘
```

**这些解释文案不是写死的**——每一句都由 `PlanReason.values` 里的真实数值填充（`daysSince: 7`、`avgCompletion: 0.96`、`matrix: 0.20`），换一组数据就换一句话。UI 侧只负责按 `code` 选样式（红/绿/灰），文案由引擎给全。

### 10.8 用户点「今天不想练引体」→ 重算

`excludeSkills = ['pullups']`，`revision: 1 → 2`。
候选池去掉引体后，主训与辅助前 2 名不变，第 3 个辅助由**倒立撑（0.3812）**递补：

| | 调整前 | 调整后 |
|---|---|---|
| 主训 | 深蹲 · 支撑深蹲 2×15 | 深蹲 · 支撑深蹲 2×15 |
| 辅助 1 | 举腿 1×10 | 举腿 1×10 |
| 辅助 2 | 引体向上 2×11 | 桥 · 直桥 2×20 |
| 辅助 3 | 桥 2×20 | **倒立撑 · 靠墙顶立 保持 30 秒 × 1** |
| 解释新增 | — | 「已按你的要求排除引体向上；倒立撑从未训练，作为替补辅助训练。注意：昨天练过俯卧撑，今天叠加垂直推类负荷，建议控制强度。」 |

注意系统**没有随机换一个动作**，而是走完同一套打分与约束后取次优，并且**主动提示了重叠风险**。

### 10.9 用户把时间改成 15 分钟 → 重算

`availableMinutes: 45 → 15`，`restSeconds: 90 → 60`，`maxItems: 4 → 2`，`assistSetCap: 2 → 1`。

| | 45 分钟 | 15 分钟 |
|---|---|---|
| 主训 | 深蹲 2×15（休息 90s） | 深蹲 2×15（休息 60s，3.5 min） |
| 辅助 | 举腿 + 引体向上 + 桥 | **举腿 1 组 × 10 次**（1.7 min） |
| 项数 | 4 | 2 |
| 预估耗时 | 14.7 min | **5.2 min** |
| 解释 | — | 「时间限制为 15 分钟，已只保留主训练 + 1 个辅助训练，并压缩组间休息至 60 秒。」 |

### 10.10 冷启动验证（零历史）

首次使用、无任何训练记录时：所有 `recoveryNeed = 1.00`、`completionHealth = 0.75`、`fatigueNow = 3`、`overlap48h = 0`，得分完全由 `planFocus` 决定 → 主训必然是**原书第一艺（俯卧撑）**，辅助按互补性选出**深蹲 + 引体向上 + 举腿**。

这与用户给出的推荐示例「引体 + 深蹲 + 举腿」结构完全同构，且**不需要写任何"首次使用特判"**——是同一套公式在零数据下的自然输出。这验证了模型的退化行为是合理的。

### 10.11 训练结束后的闭环演示

用户按计划完成**辅助训练「桥」**：`2 组 × 20 次` 全部完成，反馈「正常」（3）。

写入：
```
WorkoutSet: [{target:20, actual:20, done:true}, {target:20, actual:20, done:true}]
completionRatio = 40 / 40 = 1.00
fatigue = 3
```

判定：`ratio ≥ 1.00 且 fatigue ≤ 3` → **轻松完成** → `consecutiveEasy: 1 → 2`
`tierUp.easySessions = 2` 且疲劳均值 2.5 ≤ 3.0 → **提议 `volumeTier: 1 → 2`**（该档位的 `progressionStandard` 为「3 组 × 40 次」）
UI 显示：「桥 已连续 2 次轻松完成 2 组 × 20 次，下次试试 **3 组 × 40 次**（升阶标准）　[确认加量]」

下一次生成计划时，桥的 `recoveryNeed` 归零、`fatigueNow` 抬升、`overlap48h = 1.00` → **自动退出候选前列**，由下一个恢复充分的艺接棒（此时深蹲刚练完、引体与举腿成为新的领先者）。闭环成立。

**注意两件事**：
1. 桥的训练量提升**没有自动生效**，要先经用户点「确认加量」——满足"不要每次训练都自动升级"。
2. 桥的 `currentStep` 依然是 2，**难度没变**，变的只是同一式内的训练量档——这就是 §8.1 的分离原则在数据上的体现。

---

## 11. 配置清单（单一可调入口）

```ts
// src/lib/plan/config.ts
export interface PlanConfig {
  weights: {                       // §5.2
    recovery: number; completion: number; focus: number;
    fatigue: number; overlap: number; stall: number;
  };
  focus: { primary: number; others: number; mastered: number };
  recovery: { floorDays: number; fullDays: number };
  completion: { noHistoryDefault: number; window: number };
  fatigue: { neutral: number; decayPerDay: number };
  overlap: {
    lookbackHours: number;
    matrix: Record<ArtSlug, Record<ArtSlug, number>>;   // §0.2
    maxWithMain: number;          // 0.60
    maxBetweenAssists: number;    // 0.60
  };
  assistWeights: { score: number; complement: number; freshness: number };  // 0.5/0.3/0.2
  gate: {
    trainedTodayHours: number;    // 20
    highFatigueScore: number;     // 4.5
    stallRestHours: number;       // 48
    minPool: number;              // 3（不足则逐条放回）
  };
  minutes: Record<15 | 30 | 45 | 60, {
    maxItems: number;
    mainVolumeOffset: number;
    restSeconds: number;
    assistRestSeconds: number;
    assistSetCap: number;
    optionalPool: boolean;
  }>;
  estimate: { prepSeconds: number; secondsPerRep: Record<MetricKind | 'pull', number> };
  progression: typeof PROGRESSION_DEFAULT;   // §8.3
  stepAdjustments: typeof STEP_ADJUSTMENTS;
  fatigueCap: { highAvg: number; reduceItems: number };   // 4.0 / −1
}
```

**所有可调项集中在 `config.ts` 一个文件**，改权重不需要碰任何算法代码。建议配一个 dev-only 的「调参页」（复用现有 `/dev/ui` 的模式，生产构建剔除）实时改权重看分数变化。

---

## 12. 文件落位与实施顺序

### 12.1 新增文件

```
src/types/plan.ts                    领域类型（§2，与现有 src/types/index.ts 平级、互不侵入）
src/lib/plan/config.ts               全部权重阈值（§11）
src/lib/plan/volumeLadder.ts         从 Move.trainingGoal 解析三档阶梯（纯函数 + 单测）
src/lib/plan/snapshot.ts             派生 SkillSnapshot（§3）
src/lib/plan/gate.ts                 硬门控 + 软放回（§4.2）
src/lib/plan/priority.ts             优先级评分（§5）
src/lib/plan/select.ts               主训 + 辅助选择（§7）
src/lib/plan/budget.ts               时间预算 / 组次 / 耗时估算（§7.4–7.5）
src/lib/plan/explain.ts              解释文案生成（§10.7）
src/lib/plan/progression.ts          晋级 / 维持 / 降阶判定（§8）
src/lib/plan/index.ts                导出 generateDailyPlan / replan（唯一入口）
src/lib/plan/__tests__/*.test.ts     单测：阶梯解析、门控、打分、选择、晋级（模拟数据 §10）
src/hooks/useTrainingState.ts        localStorage 读写 + actions
```

### 12.2 与 v2 UI 的衔接

| v2 UI 位置 | 消费的契约字段 |
|---|---|
| `/plan` 今日计划卡 | `DailyPlan.main` / `assists` / `summary` / `totalEstimatedMinutes` |
| 「为什么今天练这些」折叠面板 | `DailyPlan.reasons` + `scores[slug].factors` |
| 「今天没有安排」区块 | `DailyPlan.excluded[].text` |
| 加练自选池 | `DailyPlan.optional` |
| 计划页的排除 / 换方案 / 加减量按钮 | 调 `replan(state, plan, patch, cfg)` |
| 训练执行页（逐组打勾） | `PlanItem.sets/targetPerSet` → 写 `WorkoutSet.actual` |
| 训练后的疲劳反馈 | `TrainingFeedback.fatigue` |
| 六艺进度时间线（首页 / 艺详情） | `TrainingSkill.currentStep` / `volumeTier` / `status` |
| 晋级建议卡 | `snapshot.progressionReady` + `progressionHint` |

### 12.3 实施顺序（与 UI 的关系）

| 阶段 | 内容 | 是否依赖 UI | 可并行 |
|---|---|---|---|
| **S1** | `types/plan.ts` + `config.ts` + `volumeLadder.ts` + 单测 | 否 | — |
| **S2** | 引擎全链路（snapshot → explain）+ 用 §10 模拟数据做快照测试 | 否 | 与 S3 并行 |
| **S3** | v2 视觉层（token / 字体 / 卡片组件）+ 进度系统（勾选 / 完成本式 / 六艺时间线） | — | 与 S2 并行 |
| **S4** | `/plan` 计划页 UI + 训练执行页 + 反馈闭环（**必须等 S2 契约冻结**） | 是 | — |
| **S5** | 调参 dev 页 + 手感打磨 | 否 | — |

**结论：先做规则（S1+S2），UI 只把 `/plan` 计划页（S4）推后，其余 UI 可与规则并行。** 引擎 100% 不需要界面就能做完、跑通、验证；反过来若先做计划页 UI，契约一改就得返工。

---

## 13. 与原书方法论的一致性检查

| 原书原则 | 本系统的落地 |
|---|---|
| 六艺各自推进，一门一门来 | `planFocus.primary = 1.00`，主练艺权重最高 |
| 不练到力竭 | 时间预算不填满；`promote` 要求疲劳可控；连续失败自动降量 |
| 组间充分休息 | 休息时长随时间档提升（60→120s），不是越短越好 |
| 循序渐进，不跳级 | 难度（Step）与训练量（Tier）分离；晋级必须**先爬满训练量**且**用户确认** |
| 高阶动作需谨慎 | 第 7 式起规则自动保守化（`STEP_ADJUSTMENTS`）；带 `riskNote` 的式强制安全提示 |
| 安全优先 | 恢复日兜底、疲劳抑制项数、晋级卡附安全入口均不可绕过 |

---

## 14. 决策记录（原「待确认事项」，2026-09-30 已定）

用户授权「按合理、适合正常生活状态」自行决定，结论如下：

### 14.1 时间预算不填满 ✅ 采纳 §7.6

**保留「不填满」**，并按 §7.6 落地三件事：计划卡显式打印「计划约 15 分钟 / 你有 45 分钟 /
剩余 30 分钟」；提示剩余时间用于热身 5 分钟与拉伸；提供加练自选池（不自动加入）。

理由：目标用户是上班族，45 分钟档实际只需 15 分钟恰好匹配「下班后挤出一点时间」的真实场景；
强行排满会引入循环训练，直接违背原书「不练到力竭」的核心原则。

### 14.2 疲劳反馈粒度 ✅ 单次 4 档 + 可选逐组

**训练结束后一次 4 档选择**（状态很好 / 状态不错 / 正常 / 很累 → 1/2/3/5），
外加**默认预填目标值的逐组输入**：状态正常时点一下就能提交，想细记的人再用 −/+ 调整。

理由：训练完是又累又懒得操作的时候，粒度越细越会被整段略过；
但「逐组实际次数」是完成度计算的唯一输入，不能砍掉，所以做成「默认可直接过、想改能改」。

### 14.3 `daysPerWeek` 的实际用途 ✅ 新增「周计划缺口」因子（只作用于项数）

**不参与 Priority Score**，只作用于项数：

```
本周剩余天数已不足以补足训练次数缺口 → 今天多排 1 个辅助训练
最终项数 = clamp(时间档 maxItems + 周缺口加成 − 疲劳抑制, 1, 5)
```

- 周三：剩 5 天、缺口 3 次 → 5 ≥ 3 → **不加项**（时间还充裕）；
- 周六：剩 2 天、缺口 3 次 → 2 < 3 → **加 1 项**（确实该多练一点）。

为什么不做进优先分：若给所有艺加同一个常量，改变不了排序，等于白加；
若做成差异化加分，又会与 `daysSince` 重复计分（本周没轮到的艺，天数本来就大）——
属于需求里明确反对的「为了智能而增加的、没有实际意义的复杂算法」。见 `config.WEEK_PLAN`。

### 14.4 「今天只想练某类」入口 ✅ 已暴露

计划页提供「今天不想练哪门？」的六艺开关（`excludeSkills`），点按即重算。
`onlySkills` 引擎已支持，但 UI 上以「排除」为主要交互 —— 用户想的是「不练什么」，
而不是「只练什么」，前者少一次心智转换。

### 14.5 多设备同步 ⏸ 暂不做

仍然完全本地（`localStorage['cc.training.v1']`）。页面上明确告知用户「数据只存在这台设备」。
