/**
 * InfoList —— 「要领要点 / 常见错误」通用列表（v3 简约化）。
 *
 * 两种外观：
 * - `card`（默认）：每条一个淡底圆角块 + 左侧 3px 色条 + 语义图标，
 *   用于需要「块状强调」的场景（组件陈列 / 独立提示）。
 * - `plain`：**去掉底色、描边与左侧色条**，只保留一枚小语义图标 + 正文，
 *   条目贴合正文节奏。十式详情页的「要领要点」用它 —— 该板块的语义已经由
 *   折叠区的 tone 表达，条目内再铺一层色块属于重复强调，只会让页面变碎。
 *
 * 两种外观都保留「图标形状 + 颜色」双通道：去掉颜色仍能靠形状区分语义。
 * 正文接入富文本高亮，让「保持」「不要」「2 组 × 15 次」在密集文字里跳出来。
 */
import { CheckCircle, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RichText } from '@/components/ui/RichText';

/** 列表语义变体 */
export type InfoListVariant = 'success' | 'danger' | 'info';

/** 列表外观 */
export type InfoListAppearance = 'card' | 'plain';

interface VariantStyle {
  Icon: LucideIcon;
  /** 图标着色 */
  iconClass: string;
  /** 行块底色（仅 `card` 外观使用） */
  bg: string;
  /** 左侧色条（仅 `card` 外观使用） */
  stripe: string;
}

/** 完整字面量类名，供 Tailwind JIT 扫描 */
const VARIANT_STYLE: Record<InfoListVariant, VariantStyle> = {
  success: {
    Icon: CheckCircle,
    iconClass: 'text-success',
    bg: 'bg-success-soft',
    stripe: 'bg-success',
  },
  danger: {
    Icon: TriangleAlert,
    iconClass: 'text-danger',
    bg: 'bg-danger-soft',
    stripe: 'bg-danger',
  },
  info: {
    Icon: Info,
    iconClass: 'text-info',
    bg: 'bg-info-soft',
    stripe: 'bg-info',
  },
};

/** `InfoList` 的 props */
export interface InfoListProps {
  /** 列表条目 */
  items: string[];
  /** 语义变体，默认 `success` */
  variant?: InfoListVariant;
  /** 外观，默认 `card`（保持既有调用方不变） */
  appearance?: InfoListAppearance;
  className?: string;
}

/**
 * 要领 / 错误列表。
 *
 * @example
 * <InfoList appearance="plain" items={['收腹锁髋', '胸部下沉接近地面']} />
 * @example
 * <InfoList variant="danger" items={['塌腰 —— 收紧核心']} />
 */
export function InfoList({
  items,
  variant = 'success',
  appearance = 'card',
  className = '',
}: InfoListProps) {
  const { Icon, iconClass, bg, stripe } = VARIANT_STYLE[variant];

  /* ---- 简约外观：无底色、无描边、无色条，只有图标 + 正文 ---- */
  if (appearance === 'plain') {
    return (
      <ul
        className={['m-0 flex list-none flex-col gap-2.5 p-0', className]
          .filter(Boolean)
          .join(' ')}
      >
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5">
            <Icon
              aria-hidden="true"
              className={['mt-1.5 h-4 w-4 shrink-0', iconClass].join(' ')}
            />
            <RichText
              className="min-w-0 flex-1 text-base leading-[1.7] text-text"
              text={item}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      className={['m-0 flex list-none flex-col gap-2.5 p-0', className]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={[
            'flex items-start gap-3 overflow-hidden rounded-md border border-border',
            bg,
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={['w-[3px] shrink-0 self-stretch', stripe].join(' ')}
          />
          <span className="flex items-start gap-2.5 py-3 pr-3.5">
            <Icon
              aria-hidden="true"
              className={['mt-0.5 h-5 w-5 shrink-0', iconClass].join(' ')}
            />
            <RichText
              className="min-w-0 flex-1 text-base leading-[1.7] text-text"
              text={item}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
