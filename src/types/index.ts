/**
 * 全站类型契约（架构 §3.1 · 逐字对齐字段名与含义）。
 *
 * 层次关系（单向）：Pages → Components → Data → Types。
 * 本文件是「六艺十式」数据结构的**唯一真源**，数据文件、聚合层、组件、页面
 * 均从此处导入类型，禁止各自重复定义。
 */

/** 六艺 slug 字面量联合 —— 全站路由与数据的唯一真源 */
export type ArtSlug =
  | 'pushups'
  | 'squats'
  | 'pullups'
  | 'leg-raises'
  | 'bridges'
  | 'handstand-pushups';

/** 难度等级枚举（对应 PRD：序号 1-2/3-4/5-6/7-8/9-10） */
export type MoveDifficulty = '入门' | '初级' | '中级' | '进阶' | '高阶';

/** 动作所在艺的精简引用（用于 Move 内部，避免循环依赖） */
export interface ArtRef {
  slug: ArtSlug;
  nameZh: string;
  nameEn: string;
}

/** 上一式 / 下一式的精简引用，由聚合层派生 */
export interface StepRef {
  stepNo: number;
  nameZh: string;
  href: string; // 形如 /arts/pushups/2
}

/** 单式（Move）完整模型：PRD 第 4 章 13 字段 + riskNote + english(预留) */
export interface Move {
  /** 所属艺引用（写入数据文件时给出，聚合层据此补齐） */
  artRef: ArtRef;

  /** 序号 1–10 */
  stepNo: number;

  /** 中文名，如「标准俯卧撑」 */
  nameZh: string;

  /** 英文名，如「Full Push-ups」（检索 + 图片 prompt 用） */
  nameEn: string;

  /** 首版 UI 纯中文，此字段为将来双语预留；等于 nameEn */
  english?: string;

  /** 难度等级 */
  difficulty: MoveDifficulty;

  /** 动作描述：一段话说明这是什么动作、练什么 */
  description: string;

  /** 分解步骤：有序列表，4–7 步 */
  steps: string[];

  /** 要领要点：3–5 条 */
  keyPoints: string[];

  /**
   * 常见错误：每条含「错误表现 —— 纠正方法」。
   *
   * 【2026-10-01 内容审核】原书**没有**「常见错误」这一节，只有少数式子在
   * 「解析 / 稳扎稳打」里明确点出了错误做法（如「不要撅屁股或者塌腰」
   * 「双腿朝两边分开、上身丑陋地扭曲」）。本字段是**在原书要求之上做的合理推导**：
   * 每一条都由该式原书原文里的某条具体要求反推而来，纠正部分尽量直引原文措辞，
   * 以便逐条追溯到原书。
   *
   * ⚠️ 这条宽容**不适用于** `description` / `steps` / `keyPoints` ——
   * 那几处必须严格忠于原书，不得推导。
   *
   * 60 式全部填写，故为必填：漏填会让 tsc 直接报错，而不是页面上静默少一块。
   */
  commonMistakes: string[];

  /** 进阶标准：达到什么程度算过关 */
  progressionStandard: string;

  /** 降阶方案：太难时的退阶（指向上一式或替代） */
  regression: string;

  /** 训练目标：组数×次数 / 时长 */
  trainingGoal: string;

  /** 主要发力肌群 */
  muscles: string[];

  /** 高风险动作额外提示；仅高风险式（倒立撑全系、桥全系、单臂类）填写 */
  riskNote?: string;

  /**
   * 【派生字段 · 数据文件禁止手写】
   * 上一式，第一式为 null —— 由聚合层（`src/data/index.ts`）按下标生成。
   * 写入数据文件时留空（不写该键），以免人工编号错漏。
   */
  prevStep?: StepRef | null;

  /**
   * 【派生字段 · 数据文件禁止手写】
   * 下一式，第十式为 null —— 由聚合层（`src/data/index.ts`）按下标生成。
   * 写入数据文件时留空（不写该键），以免人工编号错漏。
   */
  nextStep?: StepRef | null;
}

/** 艺（Art）展示元数据 */
export interface Art {
  slug: ArtSlug;
  order: number; // 固定原书顺序 1–6
  nameZh: string;
  nameEn: string;
  /** 一句话定位（卡片用） */
  tagline: string;
  /** 页头介绍段落 */
  intro: string;
  /** 主要发力肌群（艺级概览） */
  muscles: string[];
  /** 该艺 10 式（顺序 = stepNo） */
  moves: Move[];
}

/** 派生后的完整动作视图（保证 prevStep/nextStep 非 undefined） */
export type ResolvedMove = Move & {
  prevStep: StepRef | null;
  nextStep: StepRef | null;
  slug: string; // 如 pushups-05
};
