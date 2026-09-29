/**
 * InfoList —— 「要领要点 / 常见错误」通用列表。
 *
 * 支持两种语义变体：
 * - `success`：用于「要领要点」（对勾图标）；
 * - `danger`：用于「常见错误」（警示三角图标）。
 *
 * 语义**不仅靠颜色**：两种变体的图标形状不同（对勾 vs 警示三角），
 * 颜色（`success` / `danger` token）仅作辅助强化（架构 §9.7.2）。
 */
import { CheckCircle, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 列表语义变体 */
export type InfoListVariant = 'success' | 'danger';

interface VariantStyle {
  Icon: LucideIcon;
  /** 图标着色 token 类 */
  iconClass: string;
}

const VARIANT_STYLE: Record<InfoListVariant, VariantStyle> = {
  success: { Icon: CheckCircle, iconClass: 'text-success' },
  danger: { Icon: TriangleAlert, iconClass: 'text-danger' },
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
  const { Icon, iconClass } = VARIANT_STYLE[variant];

  return (
    <ul className={['m-0 flex list-none flex-col gap-2.5 p-0', className].filter(Boolean).join(' ')}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2.5">
          <Icon
            aria-hidden="true"
            className={['mt-0.5 h-5 w-5 shrink-0', iconClass].join(' ')}
          />
          <span className="text-base leading-[1.7] text-text">{item}</span>
        </li>
      ))}
    </ul>
  );
}
