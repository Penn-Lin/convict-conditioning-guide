/**
 * RiskNote —— 高风险动作风险提示块。
 *
 * 用于倒立撑全系、桥全系、单臂类等高危动作。视觉上**醒目但不刺眼**：
 * 采用 danger token 的粗左描边 + 极浅底色，正文使用常规正文色（`text-text`），
 * 保证浅色主题下对比度达标（架构 §9.7.2）。
 *
 * 语义同时由「警示图标形状 + 标题文字」承载，不仅靠颜色。
 */
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

/** `RiskNote` 的 props */
export interface RiskNoteProps {
  /** 标题，默认「高风险动作」 */
  title?: string;
  /** 文本内容（与 `children` 二选一） */
  text?: string;
  /** 富文本内容（优先于 `text`） */
  children?: ReactNode;
  className?: string;
}

/**
 * 风险提示块。
 *
 * @example
 * <RiskNote text="本式对肩颈压力较大，务必在保护或墙体支撑下练习。" />
 */
export function RiskNote({
  title = '高风险动作',
  text,
  children,
  className = '',
}: RiskNoteProps) {
  return (
    <aside
      role="note"
      className={[
        'rounded-md border border-danger/70 border-l-4 bg-danger/5 p-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="mb-1.5 flex items-center gap-2 text-base font-semibold text-text">
        <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-danger" />
        {title}
      </p>
      <div className="text-base leading-[1.7] text-text">{children ?? text}</div>
    </aside>
  );
}
