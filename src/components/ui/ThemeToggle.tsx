/**
 * ThemeToggle —— 主题切换开关。
 *
 * 消费既有的 `useTheme` hook（`{ theme, resolvedTheme, setTheme, toggle }`），
 * 在浅 / 深主题之间切换。**挂载到 Header 由 T07 负责**，本组件只做外观与行为。
 *
 * 可访问性：`aria-label` 描述「切换后的目标」而非当前态；触控目标 44×44px。
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

/** `ThemeToggle` 的 props */
export interface ThemeToggleProps {
  className?: string;
}

/**
 * 主题切换按钮。
 *
 * @example
 * <ThemeToggle />
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? '切换到浅色主题' : '切换到深色主题';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      className={[
        'inline-flex h-11 w-11 items-center justify-center rounded border border-border bg-surface text-text',
        'transition-colors hover:border-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="h-5 w-5" />
      ) : (
        <Moon aria-hidden="true" className="h-5 w-5" />
      )}
    </button>
  );
}
