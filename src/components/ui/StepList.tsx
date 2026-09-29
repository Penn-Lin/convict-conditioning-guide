/**
 * StepList —— 分解步骤有序列表。
 *
 * 层级完全依靠**大字号序号 + 缩进**表达，**不依赖颜色**（架构 §9.7.2）：
 * 序号使用等宽大数字，正文使用常规字号，形成清晰的视觉阶梯。
 */
export interface StepListProps {
  /** 有序步骤（顺序即序号 1..n） */
  steps: string[];
  className?: string;
}

/**
 * 分解步骤列表。
 *
 * @example
 * <StepList steps={['手掌与肩同宽撑地', '身体保持一条直线', '屈肘下放至胸口']} />
 */
export function StepList({ steps, className = '' }: StepListProps) {
  return (
    <ol className={['m-0 flex list-none flex-col gap-3 p-0', className].filter(Boolean).join(' ')}>
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3">
          {/* 序号：大字号 + 等宽数字强化层级（不使用颜色承载信息） */}
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface2 font-mono text-base font-semibold text-text"
          >
            {index + 1}
          </span>
          <span className="pt-1 text-base leading-[1.7] text-text">{step}</span>
        </li>
      ))}
    </ol>
  );
}
