/**
 * DifficultyBadge —— 难度等级徽章。
 *
 * 可访问性（架构 §9.7.2）：**必须「文字 + 颜色」双通道**，禁止仅用颜色承载信息。
 * 因此本组件始终输出难度文字标签，颜色仅作辅助（描边 / 底色 / 圆点）。
 *
 * 颜色取自 `constants.ts` 的 `DIFFICULTY_TOKEN`（`lv-1..lv-5`），此处把 token
 * 展开为**静态完整类名字面量**，以便 Tailwind JIT 扫描生成（动态拼接类名不会被扫描）。
 *
 * 对比度方案（T13 修复 · 2026-09-29）：
 * 早期版本用「同色 10% 浅底 + 同色文字」（`bg-lv-X/10 text-lv-X`），浅色主题下
 * 文字对比度仅 4.13–4.39，低于 WCAG AA 4.5。现改为**主题基色底 + 全不透明度语义描边
 * + 同色语义文字**（`bg-bg border-lv-X text-lv-X`）：
 * - 文字：`lv-X` 语义色一律直接压在主题基色（浅色 = 白、深色 = 近黑）上，
 *   该组合在两套主题下均 ≥4.5:1（浅色最小 5.0、深色 ≥5.5）；
 * - 描边：`border-lv-X` 全不透明度，作为非文字关键元素 ≥3:1（浅色最小 5.0、深色 ≥5.5）；
 * - 双通道不变：文字标签为主通道，同色圆点 + 描边为颜色/形状辅助通道。
 * **保留文字标签与圆点/描边形状通道**，绝不单靠颜色承载信息。
 */
import type { MoveDifficulty } from '@/types';
import { DIFFICULTY_TOKEN } from '@/lib/constants';

/** token 色名 → 完整 Tailwind 类名（字面量必须完整写出，供 JIT 扫描） */
const TOKEN_CLASS: Record<string, string> = {
  'lv-1': 'border-lv-1 bg-bg text-lv-1',
  'lv-2': 'border-lv-2 bg-bg text-lv-2',
  'lv-3': 'border-lv-3 bg-bg text-lv-3',
  'lv-4': 'border-lv-4 bg-bg text-lv-4',
  'lv-5': 'border-lv-5 bg-bg text-lv-5',
};

/** `DifficultyBadge` 的 props */
export interface DifficultyBadgeProps {
  /** 难度等级（五档之一） */
  difficulty: MoveDifficulty;
  className?: string;
}

/**
 * 难度徽章：文字标签 + 同色圆点（颜色为辅助通道，文字为主通道）。
 *
 * @example
 * <DifficultyBadge difficulty="中级" />
 */
export function DifficultyBadge({
  difficulty,
  className = '',
}: DifficultyBadgeProps) {
  const tokenClass = TOKEN_CLASS[DIFFICULTY_TOKEN[difficulty]] ?? '';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded border px-2 py-0.5',
        'text-xs font-medium leading-tight',
        tokenClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 颜色通道：随 difficulty 变色；形状通道由文字提供 */}
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {difficulty}
    </span>
  );
}
