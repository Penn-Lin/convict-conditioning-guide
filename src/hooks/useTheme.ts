/**
 * 主题 hook（架构 §9.3.3 · T02）。
 *
 * 设计要点：
 * - 持久键 `'theme'`，取值 `'light' | 'dark'`（首版）；缺省 `'light'`。
 * - `toggle()` 在 `'light'` / `'dark'` 间切换，并**同步** `<html>` 的 `dark` 类
 *   （通过 `document.documentElement.classList.toggle` 操作，**不在根组件挂 state**）。
 * - 持久键与取值格式必须与 `index.html` 的防闪烁内联脚本一致，否则首屏会闪烁。
 * - **预留 `'system'` 值（P1）**：类型层已支持，本轮**不实现**监听系统偏好；
 *   `'system'` 暂按缺省 `'light'` 解析。后续只需在 `resolveTheme` 内加一层
 *   `matchMedia('(prefers-color-scheme: dark)')` 分支即可，无需改动 token 结构。
 * - **不引入** `next-themes` 等主题库。
 */
import { useCallback, useEffect } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/constants';
import { useLocalStorage } from '@/hooks/useLocalStorage';

/** 用户可持久化的主题偏好原始值（`system` 为 P1 预留，本轮不启用） */
export type Theme = 'light' | 'dark' | 'system';

/** 实际生效的主题（`system` 解析后的落点，只有两种） */
export type ResolvedTheme = 'light' | 'dark';

/** 缺省主题：浅色（PRD v1.1「移动端可读性优先」） */
export const DEFAULT_THEME: ResolvedTheme = 'light';

/** 把生效主题同步到 `<html>` 的 `dark` 类（SSR 安全） */
function applyThemeClass(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * 把持久化的原始偏好解析为实际生效主题。
 * 本轮不监听系统偏好，`'system'` 暂回落至缺省浅色（P1 再补 matchMedia）。
 */
function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? DEFAULT_THEME : theme;
}

/** `useTheme` 的返回值契约 */
export interface UseThemeResult {
  /** 持久化的原始偏好（可能是 `'system'`） */
  theme: Theme;
  /** 实际生效的主题（`'light' | 'dark'`） */
  resolvedTheme: ResolvedTheme;
  /** 设置主题：写入 `localStorage` 并同步 `<html>` 类 */
  setTheme: (theme: Theme) => void;
  /** 在浅 / 深之间切换 */
  toggle: () => void;
}

/**
 * 读取 / 切换主题。
 *
 * @returns 主题状态与操作函数（见 {@link UseThemeResult}）
 */
export function useTheme(): UseThemeResult {
  const [theme, setStoredTheme] = useLocalStorage<Theme>(
    THEME_STORAGE_KEY,
    DEFAULT_THEME,
  );

  const resolvedTheme = resolveTheme(theme);

  // 将生效主题同步到 <html>（幂等；首屏深色由 index.html 内联脚本先行挂上）。
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      setStoredTheme(next);
    },
    [setStoredTheme],
  );

  const toggle = useCallback(() => {
    setStoredTheme((prev) => (resolveTheme(prev) === 'dark' ? 'light' : 'dark'));
  }, [setStoredTheme]);

  return { theme, resolvedTheme, setTheme, toggle };
}
