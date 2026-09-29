/**
 * ProgressionPath —— 十式进阶阶梯条（1 → 10），当前式高亮。
 *
 * 定位为**只读进度的可视化指标**（非交互元素）：在 375px 宽度下用一行十个等距
 * 圆点均匀铺开，圆点固定尺寸、连接线弹性伸缩，**不换行、不横向溢出**。
 * 步骤之间的跳转由 `PrevNextNav` 承担。
 *
 * 两种语境：
 * - **进度模式**：传入 `currentStepNo` 时，当前式高亮，并在下方打印「当前：第 N 式」说明。
 * - **总览模式（v1.3 补齐）**：**不传** `currentStepNo` 时，作为「十式路径指示」使用——
 *   十个圆点统一中性态、无任一高亮，也不打印「当前」行。用于六艺详情页等**无「当前所练式」
 *   的总览语境**，避免错误地把某一式当作「当前」。
 *
 * 当前式高亮采用「描边 + 底色 + 加粗 + `aria-current`」多重通道，
 * 不单独依赖颜色传递状态（架构 §9.7.2）。
 */

/** 阶梯条上的单个台阶 */
export interface ProgressionStep {
  /** 序号 1–10 */
  stepNo: number;
  /** 招式中文名（用于当前式说明文字） */
  nameZh: string;
}

/** `ProgressionPath` 的 props */
export interface ProgressionPathProps {
  /** 十式（顺序 = stepNo 升序） */
  steps: ProgressionStep[];
  /**
   * 当前所在式号。
   * **省略时进入「总览模式」**：不打印「当前：第 N 式」行，十个圆点统一为中性态。
   */
  currentStepNo?: number;
  /** 无障碍名称，默认「十式进阶阶梯」 */
  ariaLabel?: string;
  className?: string;
}

/**
 * 进阶阶梯条。
 *
 * @example
 * // 进度模式：高亮第 5 式，并打印「当前：第 5 式 · 标准俯卧撑」
 * <ProgressionPath steps={steps} currentStepNo={5} />
 *
 * @example
 * // 总览模式：仅作为十式路径指示，无当前式高亮、无「当前」行
 * <ProgressionPath steps={steps} ariaLabel="十式进阶总览（第 1 至第 10 式）" />
 */
export function ProgressionPath({
  steps,
  currentStepNo,
  ariaLabel = '十式进阶阶梯',
  className = '',
}: ProgressionPathProps) {
  // 未指定当前式即进入「总览模式」。
  const isOverview = currentStepNo === undefined;
  const current = isOverview
    ? undefined
    : steps.find((step) => step.stepNo === currentStepNo);
  const lastIndex = steps.length - 1;

  return (
    <nav
      aria-label={ariaLabel}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <ol className="m-0 flex list-none items-center p-0">
        {steps.map((step, index) => {
          // 总览模式不高亮任何一式，十个圆点保持一致的中性态。
          const isCurrent = !isOverview && step.stepNo === currentStepNo;
          return (
            <li
              key={step.stepNo}
              className={['flex min-w-0 items-center', index === lastIndex ? 'flex-none' : 'flex-1'].join(' ')}
            >
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs leading-none',
                  isCurrent
                    ? 'border-accent bg-accent font-bold text-bg'
                    : 'border-border bg-surface2 text-muted',
                ].join(' ')}
              >
                {step.stepNo}
              </span>
              {index < lastIndex ? (
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
      {!isOverview ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          当前：第 {currentStepNo} 式
          {current ? ` · ${current.nameZh}` : ''}
        </p>
      ) : null}
    </nav>
  );
}
