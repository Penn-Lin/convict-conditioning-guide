/**
 * 富文本高亮引擎（纯函数，零依赖）。
 *
 * 目标：不引入 markdown 库，用一套**规则解析**把 60 式正文里的四类信息自动分成
 * 四种固定语义样式，让「重点」在手机上一眼可辨。
 *
 * | 类型 | 触发内容 | 语义 | 样式 |
 * |---|---|---|---|
 * | `metric` | `3 组 × 50 次`、`保持 2 分钟`、`45°`、`80%` | 可量化的计量 | 橙色等宽高亮块 |
 * | `good` | `保持`、`收紧`、`锁成一条直线`… | 正确做法 | 绿色加粗 |
 * | `risk` | `塌腰`、`不要`、`借力`、`疼痛`… | 风险 / 禁忌 | 红色加粗 |
 * | `term` | `肩胛`、`后链`、`腰椎`… | 专有术语 | 点线下划线 |
 *
 * 优先级：`risk` > `good` > `metric` > `term`（同一位置先命中者胜），
 * 避免「不要塌腰」被拆成绿色 + 红色两段互相打脸。
 */

/** 高亮类型 */
export type HighlightKind = 'metric' | 'good' | 'risk' | 'term';

/** 解析出的片段；`kind === null` 表示普通文本 */
export interface HighlightToken {
  text: string;
  kind: HighlightKind | null;
}

/* ---------------------------------------------------------------------------
 * 规则词表（改这里即可调整全站高亮行为，不动渲染代码）
 * ------------------------------------------------------------------------ */

/** 风险 / 禁忌词（红色）—— 出现即代表「做错了会受伤或失效」 */
const RISK_WORDS: readonly string[] = [
  '不要',
  '避免',
  '禁止',
  '严禁',
  '塌腰',
  '弓背',
  '塌腰弓背',
  '耸肩',
  '借力',
  '惯性',
  '摆荡',
  '甩腿',
  '抢速',
  '代偿',
  '力竭',
  '疼痛',
  '受伤',
  '锁死',
  '猛',
  '憋气',
  '旋转',
  '失控',
  '错误',
  '否则',
  '不得',
  '切勿',
  '危险',
  '扭伤',
  '拉伤',
  '落地',
  '撑不住',
];

/** 正确做法词（绿色）—— 出现即代表「这是这一式的关键」 */
const GOOD_WORDS: readonly string[] = [
  '保持',
  '收紧',
  '夹紧',
  '挺直',
  '稳定',
  '受控',
  '控制',
  '对齐',
  '顶住',
  '压紧',
  '锁成一条直线',
  '一条直线',
  '垂直',
  '缓慢',
  '匀速',
  '贴地',
  '并拢',
  '对称',
  '主导',
  '发力',
  '重心',
  '全程',
  '自然呼吸',
  '肩胛',
  '收紧核心',
];

/** 专有术语（点线下划线）—— 帮助读者定位「这一段在讲哪块肌肉/哪个结构」 */
const TERM_WORDS: readonly string[] = [
  '核心',
  '后链',
  '髋',
  '髋屈肌',
  '腰椎',
  '脊柱',
  '肩袖',
  '肩关节',
  '肘关节',
  '腕关节',
  '膝关节',
  '颈椎',
  '肱二头肌长头腱',
  '前锯肌',
  '三角肌前束',
  '腹直肌',
  '腹外斜肌',
  '臀大肌',
  '竖脊肌',
  '胸大肌',
  '腘绳肌',
  '斜方肌',
  '小臂',
  '前臂',
  '离心',
  '向心',
  '等长',
  '关节',
];

/**
 * 计量表达式（橙色）。
 *
 * 覆盖站内真实写法：`3 组 × 50 次`、`2 组 × 10 次（每侧）`、`保持 1 分钟`、
 * `45°`、`80%`、`1 秒`、`30 厘米`。
 */
const METRIC_PATTERN =
  '\\d+(?:\\.\\d+)?(?:\\s*[×xX*]\\s*\\d+(?:\\.\\d+)?)?\\s*(?:组|次|秒|分钟|度|°|%|厘米|公分|拳|掌|公斤|千克|kg|倍)';

/* ---------------------------------------------------------------------------
 * 组合正则
 * ------------------------------------------------------------------------ */

/** 转义正则元字符 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 长词优先：避免「塌腰弓背」被「塌腰」抢先切短 */
function byLengthDesc(words: readonly string[]): string[] {
  return [...words].sort((a, b) => b.length - a.length);
}

const COMBINED_PATTERN = new RegExp(
  [
    byLengthDesc(RISK_WORDS).map(escapeRegExp).join('|'),
    byLengthDesc(GOOD_WORDS).map(escapeRegExp).join('|'),
    METRIC_PATTERN,
    byLengthDesc(TERM_WORDS).map(escapeRegExp).join('|'),
  ]
    .map((part) => `(?:${part})`)
    .join('|'),
  'g',
);

/** 单条计量表达式的判定正则（模块级复用，避免每次调用重复编译） */
const METRIC_RE = new RegExp(`^${METRIC_PATTERN}$`);

/** 判定单个匹配片段的类型（按同样的优先级顺序复核） */
function kindOf(fragment: string): HighlightKind {
  if (RISK_WORDS.some((word) => fragment.includes(word))) return 'risk';
  if (GOOD_WORDS.some((word) => fragment.includes(word))) return 'good';
  if (METRIC_RE.test(fragment)) return 'metric';
  return 'term';
}

/* ---------------------------------------------------------------------------
 * 主函数
 * ------------------------------------------------------------------------ */

/**
 * 把一段正文解析为带类型标记的片段序列。
 *
 * @example
 * highlight('保持 2 分钟，不要塌腰')
 * // [
 * //   { text: '保持', kind: 'good' },
 * //   { text: ' ', kind: null },
 * //   { text: '2 分钟', kind: 'metric' },
 * //   { text: '，', kind: null },
 * //   { text: '不要', kind: 'risk' },
 * //   { text: '塌腰', kind: 'risk' },
 * // ]
 */
export function highlight(text: string): HighlightToken[] {
  if (text === '') return [];

  const tokens: HighlightToken[] = [];
  let cursor = 0;
  COMBINED_PATTERN.lastIndex = 0;

  let matched = COMBINED_PATTERN.exec(text);
  while (matched !== null) {
    if (matched.index > cursor) {
      tokens.push({ text: text.slice(cursor, matched.index), kind: null });
    }
    const fragment = matched[0];
    const kind = kindOf(fragment);
    const previous = tokens[tokens.length - 1];
    // 合并相邻同类片段，避免「不要」「塌腰」被渲染成两个独立标签
    if (previous && previous.kind === kind && previous.text !== '') {
      previous.text += fragment;
    } else {
      tokens.push({ text: fragment, kind });
    }
    cursor = matched.index + fragment.length;
    matched = COMBINED_PATTERN.exec(text);
  }

  if (cursor < text.length) {
    tokens.push({ text: text.slice(cursor), kind: null });
  }

  COMBINED_PATTERN.lastIndex = 0;
  return tokens;
}

/** 供单测 / 调参页使用：统计一段文本里各类高亮的数量 */
export function highlightStats(text: string): Record<HighlightKind, number> {
  const stats: Record<HighlightKind, number> = {
    metric: 0,
    good: 0,
    risk: 0,
    term: 0,
  };
  for (const token of highlight(text)) {
    if (token.kind !== null) stats[token.kind] += 1;
  }
  return stats;
}
