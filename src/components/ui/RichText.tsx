/**
 * RichText —— 富文本高亮渲染（消费 `lib/highlight` 的解析结果）。
 *
 * 四类高亮各有固定语义样式，**全站一致**：
 * - `metric`：计量数字（`3 组 × 50 次`）→ 橙色等宽高亮块；
 * - `good`  ：正确做法（`保持`、`收紧`）→ 绿色加粗；
 * - `risk`  ：风险 / 禁忌（`塌腰`、`不要`）→ 红色加粗；
 * - `term`  ：专有术语（`肩胛`、`后链`）→ 点线下划线。
 *
 * 可访问性：高亮**只做强化，不承载独有信息** —— 去掉颜色后句子依然完整可读，
 * 因此不违反「禁止仅用颜色传递信息」。颜色在浅 / 深两主题下均满足对比度要求。
 */
import { highlight } from '@/lib/highlight';
import type { HighlightKind } from '@/lib/highlight';

/** 每个语义类型 → 完整 Tailwind 类名（字面量，供 JIT 扫描） */
const KIND_CLASS: Record<HighlightKind, string> = {
  // 计量：等宽 + 橙色淡底 + 药丸圆角，扫一眼就能抓到数字
  metric:
    'font-mono tnum rounded-[6px] bg-accent-soft px-1 py-0.5 text-[0.94em] font-semibold text-accent',
  good: 'font-semibold text-success',
  risk: 'font-semibold text-danger',
  term: 'underline decoration-dotted decoration-[1.5px] underline-offset-4',
};

/** `RichText` 的 props */
export interface RichTextProps {
  /** 原始正文 */
  text: string;
  /** 宿主的排版类（如字号 / 行高），作用于外层元素 */
  className?: string;
  /** 渲染为哪种元素，默认 `<span>` */
  as?: 'span' | 'p' | 'div';
}

/**
 * 富文本。
 *
 * @example
 * <RichText as="p" className="text-base leading-[1.75]" text="保持 2 分钟，不要塌腰。" />
 */
export function RichText({ text, className = '', as: Tag = 'span' }: RichTextProps) {
  const tokens = highlight(text);

  return (
    <Tag className={className}>
      {tokens.map((token, index) =>
        token.kind === null ? (
          token.text
        ) : (
          <span key={index} className={KIND_CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </Tag>
  );
}

/** 高亮图例（首次阅读时解释四种颜色各是什么意思） */
const LEGEND: { kind: HighlightKind; label: string }[] = [
  { kind: 'metric', label: '计量目标' },
  { kind: 'good', label: '要点做法' },
  { kind: 'risk', label: '风险禁忌' },
  { kind: 'term', label: '专业术语' },
];

/**
 * 图例条。
 *
 * 放在长文的第一次出现处，让颜色有解释 —— 否则用户只会觉得「字花了」。
 */
export function HighlightLegend({ className = '' }: { className?: string }) {
  return (
    <ul
      className={['flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs', className]
        .filter(Boolean)
        .join(' ')}
    >
      {LEGEND.map((item) => (
        <li key={item.kind} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={KIND_CLASS[item.kind]}>
            {item.kind === 'term' ? '术语' : 'Aa'}
          </span>
          <span className="text-muted">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
