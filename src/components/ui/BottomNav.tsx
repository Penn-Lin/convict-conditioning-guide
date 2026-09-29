/**
 * BottomNav —— 移动端底部标签栏。
 *
 * 为什么需要它：v1 的导航全在顶栏汉堡菜单里，手机上打开菜单 → 选页 → 再关菜单，
 * 三次点击才能换页。而本站的主要使用场景是「训练中掏出手机，在动作页和计划页之间来回切」，
 * 这个成本太高。
 *
 * 设计约束：
 * - **只在 `< md` 显示**（桌面端顶栏导航已经铺开，不需要重复）；
 * - 固定底部 + `env(safe-area-inset-bottom)` 适配 iPhone 横条 / 安卓手势条；
 * - 每个标签 ≥44×44px 触控目标，且**图标 + 文字**双通道（不靠图标单独表意）。
 */
import { NavLink } from 'react-router-dom';
import { Dumbbell, Grid3x3, House, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** 单个标签 */
interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 仅首页需要精确匹配 */
  end?: boolean;
}

/** 标签配置（顺序即展示顺序；「训练」放在第三位，与首页的行动卡形成呼应） */
export const BOTTOM_TABS: readonly TabItem[] = [
  { to: '/', label: '首页', icon: House, end: true },
  { to: '/arts', label: '六艺', icon: Grid3x3 },
  { to: '/plan', label: '训练', icon: Dumbbell },
  { to: '/principles', label: '原则', icon: ShieldCheck },
];

/**
 * 底部标签栏。
 *
 * @example
 * <BottomNav />
 */
export function BottomNav() {
  return (
    <nav
      aria-label="底部主导航"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {BOTTOM_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    'relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 text-[11px] font-semibold transition-colors',
                    isActive ? 'text-accent' : 'text-muted hover:text-text',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={isActive ? 'h-5 w-5' : 'h-5 w-5 opacity-80'}
                      strokeWidth={isActive ? 2.4 : 1.9}
                    />
                    <span>{tab.label}</span>
                    {/* 当前页指示条：形状通道，不只靠文字颜色 */}
                    <span
                      aria-hidden="true"
                      className={[
                        'absolute top-0 h-[3px] w-8 rounded-b-pill bg-accent transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}
                    />
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
