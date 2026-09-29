/**
 * SectionCard —— 「标签 + 内容」分块卡片容器。
 *
 * 用于把「分解步骤 / 要领要点 / 常见错误 / 进阶标准」等成块内容统一包裹，
 * 保证页面节奏一致。纯展示容器，不含业务逻辑。
 */
import type { ReactNode } from 'react';

/** `SectionCard` 的 props */
export interface SectionCardProps {
  /** 区块标题（可省略，省略时不渲染标题行） */
  title?: string;
  /** 区块内容 */
  children: ReactNode;
  /** 可选锚点 id（便于页内跳转 / 目录定位） */
  id?: string;
  className?: string;
}

/**
 * 分块卡片。
 *
 * @example
 * <SectionCard title="分解步骤"><StepList steps={steps} /></SectionCard>
 */
export function SectionCard({
  title,
  children,
  id,
  className = '',
}: SectionCardProps) {
  return (
    <section
      id={id}
      className={[
        'rounded-md border border-border bg-surface p-4 sm:p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {title ? (
        <h2 className="mb-3 text-lg font-semibold leading-snug text-text">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
