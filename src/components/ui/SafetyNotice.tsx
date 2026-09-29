/**
 * SafetyNotice —— 通用安全提示块。
 *
 * 与 `RiskNote`（单式高风险提示）区分：本组件用于**站点级 / 页面级通用安全提醒**，
 * 并提供跳转「训练原则」页的入口。视觉中性克制，使用 accent 粗左描边 + 盾牌图标，
 * 语义由图标形状 + 标题文字共同承载。
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

/** `SafetyNotice` 的 props */
export interface SafetyNoticeProps {
  /** 标题，默认「安全提示」 */
  title?: string;
  /** 文本内容（与 `children` 二选一） */
  text?: string;
  /** 富文本内容（优先于 `text`） */
  children?: ReactNode;
  /** 「训练原则」入口路径，默认 `/principles` */
  principlesHref?: string;
  /** 入口文案，默认「查看训练原则」 */
  principlesLabel?: string;
  className?: string;
}

/**
 * 通用安全提示块。
 *
 * @example
 * <SafetyNotice text="训练前请充分热身，循序渐进，量力而行。" />
 */
export function SafetyNotice({
  title = '安全提示',
  text,
  children,
  principlesHref = '/principles',
  principlesLabel = '查看训练原则',
  className = '',
}: SafetyNoticeProps) {
  return (
    <aside
      role="note"
      className={[
        'rounded-md border border-border border-l-4 border-l-accent bg-surface p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="mb-1.5 flex items-center gap-2 text-base font-semibold text-text">
        <Shield aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />
        {title}
      </p>
      <div className="text-base leading-[1.7] text-text">{children ?? text}</div>
      {/* 独立交互链接（非正文行内链接，不适用 WCAG 行内例外）：触控目标 ≥44×44 */}
      <Link
        to={principlesHref}
        className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        {principlesLabel}
      </Link>
    </aside>
  );
}
