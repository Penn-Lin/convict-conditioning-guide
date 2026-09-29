import type { Config } from 'tailwindcss';

/**
 * Tailwind 设计 token（架构 §9.3 · v1.1 浅色默认 + 深色可切换）。
 *
 * 关键点：
 * - `darkMode: 'class'`：主题由 `<html class="dark">` 控制（非媒体查询）。
 * - 语义色名逐一映射到**同名 CSS 变量**，变量以「空格分隔的 RGB 通道」存储，
 *   因此既支持 `bg-bg` / `text-text`，也支持透明度修饰符 `bg-bg/80`。
 * - 页面只引用语义色名，禁止散落硬编码色值（§9.3）。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 语义 token —— 值指向 CSS 变量（见 src/index.css），主题切换只改变量值
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        // 难度 5 级（变量随主题切换）
        'lv-1': 'rgb(var(--lv-1) / <alpha-value>)',
        'lv-2': 'rgb(var(--lv-2) / <alpha-value>)',
        'lv-3': 'rgb(var(--lv-3) / <alpha-value>)',
        'lv-4': 'rgb(var(--lv-4) / <alpha-value>)',
        'lv-5': 'rgb(var(--lv-5) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'], // 数字/序号/英文名
      },
      borderRadius: { DEFAULT: '4px', md: '6px', lg: '8px' }, // 圆角克制
      screens: { sm: '640px', md: '1024px', lg: '1280px' },
      maxWidth: { prose: '72ch' }, // 桌面正文行宽 ~70–80 字符（§9.7）
    },
  },
  plugins: [],
} satisfies Config;
