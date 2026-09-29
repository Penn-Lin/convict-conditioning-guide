/**
 * PrevNextNav —— 上一式 / 下一式导航。
 *
 * **正确处理 `null` 边界**：第一式 `prev` 为 `null`、第十式 `next` 为 `null` 时，
 * 对应一侧渲染为**不可交互的占位提示**（如「已是本艺第一式」），而非空白或报错。
 *
 * 站内跳转一律使用 `<Link>`（不整页刷新）；可交互一侧触控目标 ≥44px 高。
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/** 导航目标（上一式 / 下一式） */
export interface PrevNextTarget {
  /** 目标路由，如 `/arts/pushups/4` */
  href: string;
  /** 目标名称（招式中文名） */
  label: string;
}

/** `PrevNextNav` 的 props */
export interface PrevNextNavProps {
  /** 上一式；第一式传 `null` */
  prev: PrevNextTarget | null;
  /** 下一式；第十式传 `null` */
  next: PrevNextTarget | null;
  /** 无上一式时的提示文案 */
  prevEmptyHint?: string;
  /** 无下一式时的提示文案 */
  nextEmptyHint?: string;
  className?: string;
}

const CELL_BASE =
  'flex min-h-[44px] flex-col justify-center gap-1 rounded-md border p-3';
const LINK_CLASS = `${CELL_BASE} border-border bg-surface transition-colors hover:border-accent`;
const EMPTY_CLASS = `${CELL_BASE} border-dashed border-border bg-surface2 text-muted`;

/**
 * 上一式 / 下一式导航。
 *
 * @example
 * <PrevNextNav prev={null} next={{ href: '/arts/pushups/2', label: '上斜俯卧撑' }} />
 */
export function PrevNextNav({
  prev,
  next,
  prevEmptyHint = '已是本艺第一式',
  nextEmptyHint = '已是本艺第十式',
  className = '',
}: PrevNextNavProps) {
  return (
    <nav
      aria-label="上一式 / 下一式"
      className={['grid grid-cols-2 gap-3', className].filter(Boolean).join(' ')}
    >
      {prev ? (
        <Link to={prev.href} className={LINK_CLASS}>
          <span className="flex items-center gap-1 text-xs text-muted">
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            上一式
          </span>
          <span className="truncate text-sm font-medium text-text">{prev.label}</span>
        </Link>
      ) : (
        <div className={EMPTY_CLASS} aria-disabled="true">
          <span className="text-xs text-muted">上一式</span>
          <span className="text-sm">{prevEmptyHint}</span>
        </div>
      )}

      {next ? (
        <Link to={next.href} className={`${LINK_CLASS} items-end text-right`}>
          <span className="flex items-center gap-1 text-xs text-muted">
            下一式
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <span className="w-full truncate text-sm font-medium text-text">{next.label}</span>
        </Link>
      ) : (
        <div className={`${EMPTY_CLASS} items-end text-right`} aria-disabled="true">
          <span className="text-xs text-muted">下一式</span>
          <span className="text-sm">{nextEmptyHint}</span>
        </div>
      )}
    </nav>
  );
}
