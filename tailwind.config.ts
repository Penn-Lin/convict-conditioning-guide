import type { Config } from 'tailwindcss';

/**
 * Tailwind 设计 token（架构 §9.3 · v2）。
 *
 * v2 修订要点：
 * 1. **字体真正落地**：v1 声明了 `Inter` / `JetBrains Mono` 但 `index.html` 没有任何字体引用，
 *    实际渲染的是系统默认字体 —— 「靠排版传达硬核感」的设计语言是悬空的。
 *    v2 改为**中文优先的系统字体栈**（PingFang SC / HarmonyOS Sans / MiSans / 微软雅黑），
 *    数字统一走系统等宽 —— 零网络请求、零 CLS，国内首屏不卡。
 * 2. **圆角分层**：卡片 16px（`lg`）/ 内部块 12px（`md`）/ 小控件 8px（`DEFAULT`）/ 药丸 `pill`。
 * 3. **新增六艺色相**（`art-*`）与四组语义淡底（`accent-soft` / `success-soft` / `danger-soft` / `info-soft`），
 *    以及 `--border-strong` / `--text-subtle` 两个补充中性色。
 * 4. 语义色名逐一映射到**同名 CSS 变量**，变量以「空格分隔的 RGB 通道」存储，
 *    因此既支持 `bg-bg` / `text-text`，也支持透明度修饰符 `bg-bg/80`。
 *
 * 页面只引用语义色名，禁止散落硬编码色值。
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
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
        subtle: 'rgb(var(--text-subtle) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        'success-soft': 'rgb(var(--success-soft) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-soft': 'rgb(var(--danger-soft) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',
        'info-soft': 'rgb(var(--info-soft) / <alpha-value>)',
        // 难度 5 级（变量随主题切换）
        'lv-1': 'rgb(var(--lv-1) / <alpha-value>)',
        'lv-2': 'rgb(var(--lv-2) / <alpha-value>)',
        'lv-3': 'rgb(var(--lv-3) / <alpha-value>)',
        'lv-4': 'rgb(var(--lv-4) / <alpha-value>)',
        'lv-5': 'rgb(var(--lv-5) / <alpha-value>)',
        // 六艺色相（只用于序号徽章 / 进度条 / 淡底，文字仍走 text）
        'art-pushups': 'rgb(var(--art-pushups) / <alpha-value>)',
        'art-squats': 'rgb(var(--art-squats) / <alpha-value>)',
        'art-pullups': 'rgb(var(--art-pullups) / <alpha-value>)',
        'art-leg-raises': 'rgb(var(--art-leg-raises) / <alpha-value>)',
        'art-bridges': 'rgb(var(--art-bridges) / <alpha-value>)',
        'art-handstand-pushups': 'rgb(var(--art-handstand-pushups) / <alpha-value>)',
      },
      fontFamily: {
        // 中文优先的系统字体栈：零网络请求、零 CLS
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"HarmonyOS Sans SC"',
          'MiSans',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          '"SF Mono"',
          '"JetBrains Mono"',
          '"Cascadia Mono"',
          'Consolas',
          '"Noto Sans Mono"',
          'monospace',
        ],
      },
      borderRadius: {
        DEFAULT: '8px', // 小控件 / 内联块
        md: '12px', // 卡片内部子块
        lg: '16px', // 卡片
        xl: '20px', // 大卡（继续训练 / Hero）
        pill: '999px', // 触控目标 / 徽章
      },
      boxShadow: {
        // 极轻阴影：靠层次不靠描边（PRD「禁用重阴影」的边界内调整）
        card: '0 1px 2px rgb(var(--shadow-color) / 0.04), 0 4px 12px rgb(var(--shadow-color) / 0.04)',
        'card-hover':
          '0 2px 4px rgb(var(--shadow-color) / 0.06), 0 10px 24px rgb(var(--shadow-color) / 0.07)',
        // 吸底 CTA 上方的渐隐分隔
        lift: '0 -1px 0 rgb(var(--shadow-color) / 0.05), 0 -8px 24px rgb(var(--shadow-color) / 0.06)',
      },
      screens: { sm: '640px', md: '1024px', lg: '1280px' },
      maxWidth: { prose: '72ch' }, // 桌面正文行宽 ~70–80 字符
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-check': {
          '0%': { transform: 'scale(0.8)' },
          '60%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pop-check': 'pop-check 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
