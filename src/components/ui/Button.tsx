/**
 * Button —— 统一按钮 / 链接样式。
 *
 * - 站内跳转**一律使用 `<Link>`**（`to` 属性），不整页刷新；
 * - 需要触发事件的场景使用原生 `<button>`（`onClick` 属性）；
 * - 触控目标 ≥44px 高；语义 token 着色，浅 / 深主题自动适配；
 * - 全局 `:focus-visible` 焦点环**不得移除**（保持默认可聚焦样式）。
 */
import type { MouseEventHandler, ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** 按钮视觉变体 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
/** 按钮尺寸 */
export type ButtonSize = 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-accent text-bg hover:opacity-90',
  secondary: 'border border-border bg-surface text-text hover:border-accent',
  ghost: 'border border-transparent bg-transparent text-text hover:bg-surface2',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'min-h-[44px] px-4 text-sm',
  lg: 'min-h-[48px] px-5 text-base',
};

const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';

/** 两种形态共有的 props */
interface ButtonCommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  /** 无障碍名称（图标按钮必填） */
  ariaLabel?: string;
}

/** 链接形态（站内跳转） */
interface ButtonAsLinkProps extends ButtonCommonProps {
  to: string;
  onClick?: never;
  type?: never;
  disabled?: never;
}

/** 原生按钮形态（触发事件） */
interface ButtonAsButtonProps extends ButtonCommonProps {
  to?: undefined;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

/** `Button` 的 props（`to` 与 `onClick` 互斥） */
export type ButtonProps = ButtonAsLinkProps | ButtonAsButtonProps;

/**
 * 统一按钮 / 链接。
 *
 * @example
 * <Button to="/arts">浏览六艺</Button>
 * <Button variant="secondary" onClick={handle}>展开</Button>
 */
export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className = '', children, ariaLabel } = props;
  const classes = [BASE_CLASS, VARIANT_CLASS[variant], SIZE_CLASS[size], className]
    .filter(Boolean)
    .join(' ');

  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className={classes}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}
