/**
 * InfoList —— 「要领要点 / 常见错误」通用列表（v2 升级）。
 *
 * v2 从「图标 + 纯文字」升级为**语义行块**：每条一个淡底圆角块，左侧 3px 色条，
 * 图标形状区分语义（对勾 vs 警示三角），颜色仅作强化 ——
 * 去掉颜色后仍能靠图标形状与文案区分，满足「不靠颜色单独承载信息」。
 *
 * 正文接入富文本高亮，让「保持」「不要」「2 组 × 15 次」在密集文字里跳出来。
 */
import { CheckCircle, Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RichText } from '@/components/ui/RichText';

/** 列表语义变体 */
export type InfoListVariant = 'success' | 'danger' | 'info';

interface VariantStyle {
  Icon: LucideIcon;
  /** 图标着色 */
  iconClass: string;
  /** 行块底色 */
  bg: string;
  /** 左侧色条 */
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
  className?: string;
}

/**
 * 要领 / 错误列表。
 *
 * @example
 * <InfoList variant="danger" items={['塌腰 —— 收紧核心']} />
 */
export function InfoList({
  items,
  variant = 'success',
  className = '',
}: InfoListProps) {
  const { Icon, iconClass, bg, stripe } = VARIANT_STYLE[variant];

  return (
    <ul
      className={['m-0 flex list-none flex-col gap-2.5 p-0', className]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={['flex items-start gap-3 overflow-hidden rounded-md border border-border', bg].join(' ')}
        >
          <span aria-hidden="true" className={['w-[3px] shrink-0 self-stretch', stripe].join(' ')} />
          <span className="flex items-start gap-2.5 py-3 pr-3.5">
            <Icon aria-hidden="true" className={['mt-0.5 h-5 w-5 shrink-0', iconClass].join(' ')} />
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
