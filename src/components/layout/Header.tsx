/**
 * Header —— 全站顶栏（架构 §2.5 / §9.3 / §9.7 · T07）。
 *
 * 组成：
 * - 站点名（可点回首页，站内跳转用 `<Link>`，不整页刷新）；
 * - 主导航：首页 / 六艺总览 / 训练原则 / 关于（`<NavLink>` 自动标识当前页）；
 * - 移动端汉堡菜单：`<button>` + `aria-expanded` / `aria-controls`，
 *   键盘（Tab 聚焦 → Enter / Space 激活）可开关，展开为 `aria-expanded="true"`；
 * - `ThemeToggle`（T06 交付，挂载于此，`useTheme` 内部同步 `<html class="dark">`）。
 *
 * 设计取舍（克制）：
 * - 顶栏**不吸顶**（`position: static`），滚动时不产生跟随动画 / 阴影变化，
 *   避免视觉噪音；符合「移动端可读性优先、靠排版传达气质」的既定方向。
 * - 汉堡菜单在 `< md`（< 1024px）显示，桌面端直接铺开主导航。
 *
 * 可访问性：零硬编码色值（仅语义 token）；全局 `:focus-visible` 焦点环不被移除；
 * 交互元素触控目标 ≥ 44×44px（`min-h-11` / `h-11 w-11`）。
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SITE_NAME } from '@/lib/constants';

/** 主导航项 */
interface NavItem {
  /** 目标路由 */
  to: string;
  /** 导航文案 */
  label: string;
  /**
   * 是否精确匹配（仅首页需要）。
   * 不加 `end` 时，`/` 会匹配所有以 `/` 开头的路由，导致「首页」始终高亮。
   */
  end?: boolean;
}

/** 主导航配置（顺序即展示顺序） */
const PRIMARY_NAV: readonly NavItem[] = [
  { to: '/', label: '首页', end: true },
  { to: '/arts', label: '六艺总览' },
  { to: '/principles', label: '训练原则' },
  { to: '/about', label: '关于' },
];

/** 移动端菜单面板的 DOM id（与汉堡按钮的 `aria-controls` 对应） */
const MOBILE_NAV_ID = 'site-mobile-nav';

/** 桌面导航链接基础样式 */
const DESKTOP_LINK_BASE =
  'inline-flex min-h-11 items-center rounded px-3 text-sm font-medium transition-colors';

/** 移动端导航链接基础样式 */
const MOBILE_LINK_BASE = 'flex min-h-11 items-center rounded px-2 text-base font-medium';

/**
 * 顶栏。
 *
 * @example
 * <Header />
 */
export function Header() {
  const { pathname } = useLocation();
  /** 移动端汉堡菜单展开态（默认收起） */
  const [open, setOpen] = useState(false);

  // 路由变化时自动收起移动菜单（防止跳转后菜单残留）。
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        {/* 站点名（回首页）；触控目标 ≥44×44（min-h-11 + 对称 py-2.5，保持基线对齐） */}
        <Link
          to="/"
          aria-label={SITE_NAME}
          className="flex min-h-11 min-w-0 items-baseline gap-1.5 rounded py-2.5"
        >
          <span className="truncate text-base font-extrabold tracking-tight text-text">
            囚徒健身
          </span>
          {/* 小屏隐藏副标题，避免 375px 拥挤 */}
          <span className="hidden shrink-0 text-xs text-muted sm:inline">六艺十式</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* 桌面主导航（≥ md 显示） */}
          <nav aria-label="主导航" className="hidden md:flex md:items-center md:gap-1">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [DESKTOP_LINK_BASE, isActive ? 'text-accent' : 'text-text hover:text-accent']
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* 主题切换（T06 交付） */}
          <ThemeToggle />

          {/* 汉堡菜单按钮（< md 显示）：键盘可达，含 aria-expanded / aria-controls */}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={MOBILE_NAV_ID}
            aria-label={open ? '收起导航菜单' : '展开导航菜单'}
            className="inline-flex h-11 w-11 items-center justify-center rounded border border-border bg-surface text-text transition-colors hover:border-accent md:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* 移动端导航面板（< md 显示；收起时用 hidden 移出可达树） */}
      <nav
        id={MOBILE_NAV_ID}
        aria-label="移动端导航"
        className={open ? 'border-t border-border md:hidden' : 'hidden'}
      >
        <ul className="mx-auto max-w-5xl px-4 py-2">
          {PRIMARY_NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [MOBILE_LINK_BASE, isActive ? 'text-accent' : 'text-text hover:text-accent']
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
