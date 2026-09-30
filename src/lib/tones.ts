/**
 * 模块色相体系（v3）。
 *
 * ## 配色原则（这是全站上色的唯一依据，改颜色前先读这一段）
 *
 * 1. **颜色用来标识「这是哪个对象 / 哪个模块」，不用来表达「谁更重要」。**
 *    优先级与主次由**尺寸、位置、留白**承担；一旦用颜色表达优先级，
 *    页面上就会出现多个「最显眼的」，等于没有重点。
 *
 * 2. **平级的一组选项必须保持同形同色 —— 但同色不等于同一个颜色。**
 *    用户明确要求过：不要为了配色多样而破坏平行选项之间的联系。
 *    因此约定：
 *    - **同一个对象，在任何地方都用同一个颜色**（如「俯卧撑」永远是橙、
 *      「深蹲」永远是绿）—— 这叫跨位置一致性，是**加强**联系，不是破坏；
 *    - **同一组平级选项，靠相同的形状 / 尺寸 / 排布 / 状态来传达「我们是一组」**，
 *      颜色只负责回答「我是谁」。例如时间档 15/30/45/60 四项形状完全一致，
 *      只区分选中（实心）与未选中（描边）；六艺筛选 chips 形状完全一致，
 *      各自带本门艺的色相。
 *
 * 3. **模块色调（tone）只有 5 个语义**，不要随手加第 6 个：
 *
 * | tone | 色相 | 语义 | 典型用量 |
 * |---|---|---|---|
 * | `action` | 橙 accent | 今天要做什么（全站唯一的行动语义） | 首页「今天」、主按钮、训练清单 |
 * | `data` | 蓝 info | 进度、统计、记录 | 本周概况、六艺进度、训练历史 |
 * | `body` | 绿 success | 正确做法、要领、达成 | 要领要点、达标状态、勾选完成 |
 * | `risk` | 红 danger | 错误、风险、禁忌 | 常见错误、高风险提示、排除项 |
 * | `guide` | 紫 violet | 引导、说明、新手 | 「怎么开始」、解释性文案 |
 *
 * 类名必须是**完整字面量**（Tailwind JIT 扫描不到拼接出来的类名），
 * 且**透明度修饰符只能取 5 的倍数**（`/8` 这类值不报错也不生成 → 背景静默消失）。
 * `src/lib/designTokens.test.ts` 有守卫测试拦这两类问题。
 */

/** 模块色调 */
export type Tone = 'action' | 'data' | 'body' | 'risk' | 'guide' | 'neutral';

/** 单个色调的完整类名集合 */
export interface ToneStyle {
  /** 板块外框变体一：淡底 + 同色描边（用于需要强调的板块） */
  tinted: string;
  /** 板块外框变体二：白底 + 同色描边（用于次级板块） */
  outlined: string;
  /** 左侧 4px 色条 */
  stripe: string;
  /**
   * 图标胶囊：**实心色相底 + `text-bg`**。
   * `text-bg` 而非 `text-white`：浅色主题下 `--bg`≈白（5.0–8.1:1），
   * 深色主题下 `--bg`≈近黑（对亮色相 6.5–12:1）—— 一套写法同时满足两套主题，
   * 不需要为每个色调再写 `dark:` 分支。
   */
  chip: string;
  /** 色相文字（用于小字强调，压在板块底色上） */
  text: string;
  /** 色相描边 */
  border: string;
  /** 进度条 / 指示条填充 */
  bar: string;
}

/** 模块色调 → 类名（全部完整字面量，供 Tailwind JIT 扫描） */
export const TONE_STYLE: Record<Tone, ToneStyle> = {
  action: {
    tinted: 'border-accent/25 bg-accent-soft',
    outlined: 'border-accent/40 bg-surface',
    stripe: 'bg-accent',
    chip: 'bg-accent text-bg',
    text: 'text-accent',
    border: 'border-accent/40',
    bar: 'bg-accent',
  },
  data: {
    tinted: 'border-info/25 bg-info-soft',
    outlined: 'border-info/40 bg-surface',
    stripe: 'bg-info',
    chip: 'bg-info text-bg',
    text: 'text-info',
    border: 'border-info/40',
    bar: 'bg-info',
  },
  body: {
    tinted: 'border-success/25 bg-success-soft',
    outlined: 'border-success/40 bg-surface',
    stripe: 'bg-success',
    chip: 'bg-success text-bg',
    text: 'text-success',
    border: 'border-success/40',
    bar: 'bg-success',
  },
  risk: {
    tinted: 'border-danger/25 bg-danger-soft',
    outlined: 'border-danger/40 bg-surface',
    stripe: 'bg-danger',
    chip: 'bg-danger text-bg',
    text: 'text-danger',
    border: 'border-danger/40',
    bar: 'bg-danger',
  },
  guide: {
    tinted: 'border-violet/25 bg-violet-soft',
    outlined: 'border-violet/40 bg-surface',
    stripe: 'bg-violet',
    chip: 'bg-violet text-bg',
    text: 'text-violet',
    border: 'border-violet/40',
    bar: 'bg-violet',
  },
  neutral: {
    tinted: 'border-border bg-surface2',
    outlined: 'border-border bg-surface',
    stripe: 'bg-border-strong',
    chip: 'bg-surface2 text-muted',
    text: 'text-muted',
    border: 'border-border',
    bar: 'bg-border-strong',
  },
};

/** 取某个色调的类名集合 */
export function toneStyle(tone: Tone): ToneStyle {
  return TONE_STYLE[tone];
}
