/**
 * Breadcrumb —— 面包屑导航（首页 / 六艺 / 艺 / 式）。
 *
 * 最后一项为当前页，渲染为**不可点击**文本并带 `aria-current="page"`；
 * 其余项使用 `<Link>` 站内跳转。窄屏自动换行，不横向溢出。
 */
import { Link } from 'react-router-dom';

/** 面包屑条目 */
export interface BreadcrumbItem {
  /** 显示文本 */
  label: string;
  /** 跳转路径；省略或最后一项则不渲染为链接 */
  href?: string;
}

/** `Breadcrumb` 的 props */
export interface BreadcrumbProps {
  /** 由外到内的条目序列 */
  items: BreadcrumbItem[];
  /** 无障碍名称，默认「面包屑」 */
  ariaLabel?: string;
  className?: string;
}

/**
 * 面包屑。
 *
 * @example
 * <Breadcrumb items={[{ label: '首页', href: '/' }, { label: '六艺', href: '/arts' }, { label: '俯卧撑', href: '/arts/pushups' }, { label: '第 5 式' }]} />
 */
export function Breadcrumb({
  items,
  ariaLabel = '面包屑',
  className = '',
}: BreadcrumbProps) {
  return (
    <nav aria-label={ariaLabel} className={className || undefined}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isLink = !isLast && item.href !== undefined;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-muted">
                  /
                </span>
              ) : null}
              {isLink ? (
                <Link
                  to={item.href as string}
                  className="text-muted underline-offset-2 hover:text-text hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="font-medium text-text"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
