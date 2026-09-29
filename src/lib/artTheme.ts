/**
 * 六艺视觉主题映射（v2 设计系统）。
 *
 * 六门艺各有一个固定色相，**只用在序号徽章、进度条、淡底这些小面积装饰上**。
 * 正文文字永远是 `--text` —— 这是刻意的：色相用于「分区识别」，不用来承载文字信息，
 * 因此对比度红线不会被装饰色拉低。
 *
 * 类名必须是**完整字面量**，否则 Tailwind JIT 扫描不到（动态拼接类名不会被生成）。
 *
 * ⚠️ **透明度修饰符只能取 5 的倍数**（Tailwind 默认 opacity 刻度为
 * `0 5 10 15 20 … 100`）。写 `bg-art-pushups/8` 不会报错，但**这个类根本不会被生成**，
 * 结果就是背景静默消失 —— 这类问题在浏览器里只表现为「颜色不对」，极难排查。
 * `src/lib/designTokens.test.ts` 里有一条守卫测试专门拦这个。
 *
 * 每个色相同时给出浅色 / 深色两套处理：
 * - 浅色：实心色相底 + `text-bg`（对比度 5.0–7.5:1）；
 * - 深色：色相 15% 淡底 + 亮色相文字（对比度 ≈5.9:1）。
 * 直接写 `text-white` 在深色主题下只有 2.2:1，所以必须分主题处理。
 */
import type { ArtSlug } from '@/types';

/** 单个艺的视觉主题 */
export interface ArtTheme {
  /** 实心徽章（序号 / 状态点）：含浅色与深色两套 */
  solid: string;
  /** 淡底块（卡片头部 / 进度槽背景） */
  soft: string;
  /** 色相文字 / 图标 */
  text: string;
  /** 色相描边 */
  border: string;
  /** 进度条填充 */
  bar: string;
  /** 左侧色条（语义卡的 3px 竖条） */
  stripe: string;
}

/** 六艺视觉主题（键必须与 `ArtSlug` 一一对应） */
export const ART_THEME: Record<ArtSlug, ArtTheme> = {
  pushups: {
    solid: 'bg-art-pushups text-bg dark:bg-art-pushups/15 dark:text-art-pushups',
    soft: 'bg-art-pushups/10 dark:bg-art-pushups/15',
    text: 'text-art-pushups',
    border: 'border-art-pushups/30',
    bar: 'bg-art-pushups',
    stripe: 'bg-art-pushups',
  },
  squats: {
    solid: 'bg-art-squats text-bg dark:bg-art-squats/15 dark:text-art-squats',
    soft: 'bg-art-squats/10 dark:bg-art-squats/15',
    text: 'text-art-squats',
    border: 'border-art-squats/30',
    bar: 'bg-art-squats',
    stripe: 'bg-art-squats',
  },
  pullups: {
    solid: 'bg-art-pullups text-bg dark:bg-art-pullups/15 dark:text-art-pullups',
    soft: 'bg-art-pullups/10 dark:bg-art-pullups/15',
    text: 'text-art-pullups',
    border: 'border-art-pullups/30',
    bar: 'bg-art-pullups',
    stripe: 'bg-art-pullups',
  },
  'leg-raises': {
    solid:
      'bg-art-leg-raises text-bg dark:bg-art-leg-raises/15 dark:text-art-leg-raises',
    soft: 'bg-art-leg-raises/10 dark:bg-art-leg-raises/15',
    text: 'text-art-leg-raises',
    border: 'border-art-leg-raises/30',
    bar: 'bg-art-leg-raises',
    stripe: 'bg-art-leg-raises',
  },
  bridges: {
    solid: 'bg-art-bridges text-bg dark:bg-art-bridges/15 dark:text-art-bridges',
    soft: 'bg-art-bridges/10 dark:bg-art-bridges/15',
    text: 'text-art-bridges',
    border: 'border-art-bridges/30',
    bar: 'bg-art-bridges',
    stripe: 'bg-art-bridges',
  },
  'handstand-pushups': {
    solid:
      'bg-art-handstand-pushups text-bg dark:bg-art-handstand-pushups/15 dark:text-art-handstand-pushups',
    soft: 'bg-art-handstand-pushups/10 dark:bg-art-handstand-pushups/15',
    text: 'text-art-handstand-pushups',
    border: 'border-art-handstand-pushups/30',
    bar: 'bg-art-handstand-pushups',
    stripe: 'bg-art-handstand-pushups',
  },
};

/** 取某艺的视觉主题 */
export function artTheme(slug: ArtSlug): ArtTheme {
  return ART_THEME[slug];
}

/** 六艺的「训练类型」短标签（徽章 / 说明用） */
export const ART_LOAD_LABEL: Record<ArtSlug, string> = {
  pushups: '水平推',
  squats: '下肢',
  pullups: '垂直拉',
  'leg-raises': '核心',
  bridges: '后链',
  'handstand-pushups': '垂直推',
};

/** 进度状态 → 视觉表现 */
export type ProgressState = 'done' | 'current' | 'locked' | 'idle';

/** 进度状态的中文标签（**文字通道**，颜色只作辅助） */
export const PROGRESS_STATE_LABEL: Record<ProgressState, string> = {
  done: '已完成',
  current: '进行中',
  locked: '未开始',
  idle: '未开始',
};
