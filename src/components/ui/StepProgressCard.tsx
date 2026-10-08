/**
 * StepProgressCard —— 进阶条件打卡卡（需求 ② 的核心交互）。
 *
 * 一个完整的闭环：
 * ```
 * 逐项勾选 → 勾满解锁主按钮 → 点「完成本式 · 进入第 N+1 式」
 *   → 进度 +1 → 顶部提示「已进入第 N+1 式」+ 可撤销
 * ```
 *
 * 两条设计约束：
 * 1. **不让人卡死**：勾不满也能走（次要入口「跳过条件，直接标记完成」）。
 *    现实中有人今天状态不好、只想先往下看，硬卡住只会让人放弃使用。
 * 2. **确认才推进**：`currentStep` 只由用户点击驱动，永不自动上升 ——
 *    这是「不要每次训练都自动升级」在 UI 上的落点。
 *
 * v5 新增第三条，也是**硬约束**：
 * 3. **顺位门控**：第 N 式必须在 1…N−1 全部完成之后才能标记完成。
 *    原因见 `lib/plan/progression.missingPrerequisites` —— 用户曾在翻看第 3 式时
 *    误点完成键，`currentStep` 直接跳到 4，而前两式一次都没打卡。
 *    被门控挡住时，这里给出「还差哪几式」与**回到那一式的链接**，
 *    而不是只把按钮变灰让人猜（附带说明：两个入口**同时**失效，
 *    「跳过条件」只跳条件，不跳顺位）。
 *
 * 二次确认不在这里做 —— 本组件保持「纯展示 + 回调」，
 * 由容器（`MoveDetail`）用 `useConfirm()` 决定问不问、怎么问，
 * 这样同一张卡在 dev 展示页里可以脱离 Provider 单独渲染。
 */
import { Check, ChevronRight, ListChecks, RotateCcw, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ProgressionGoal } from '@/lib/checklist';
import { Checklist, ChecklistProgress } from '@/components/ui/Checklist';
import { Button } from '@/components/ui/Button';

/** `StepProgressCard` 的 props */
export interface StepProgressCardProps {
  /** 所属艺名（用于文案） */
  artName: string;
  stepNo: number;
  /** 进阶条件清单 */
  goals: ProgressionGoal[];
  /** 勾选状态 */
  checks: boolean[] | undefined;
  /** 本式是否已被标记完成 */
  completed: boolean;
  /** 下一式名称（最后一式为 null） */
  nextStepName: string | null;
  /**
   * 前置未完成的式号（升序）。非空 = 本式被顺位门控挡住，禁止标记完成。
   * 默认 `[]`（可以直接完成）。
   */
  missingSteps?: number[];
  /** 被门控挡住时，「回去把它补上」的链接（一般为第一个未完成的那一式） */
  prerequisiteHref?: string | null;
  onToggle: (index: number) => void;
  /** 条件已勾满时的正常完成入口 */
  onComplete: () => void;
  /** 「跳过条件，直接标记完成」入口（与 `onComplete` 分开，便于给不同的确认文案） */
  onSkipComplete?: () => void;
  onUndo: () => void;
  className?: string;
}

/**
 * 进阶条件打卡卡。
 *
 * @example
 * <StepProgressCard artName="俯卧撑" stepNo={4} goals={goals} checks={checks}
 *   completed={false} nextStepName="标准俯卧撑"
 *   onToggle={toggle} onComplete={complete} onUndo={undo} />
 */
export function StepProgressCard({
  artName,
  stepNo,
  goals,
  checks,
  completed,
  nextStepName,
  missingSteps = [],
  prerequisiteHref = null,
  onToggle,
  onComplete,
  onSkipComplete,
  onUndo,
  className = '',
}: StepProgressCardProps) {
  const total = goals.length;
  const checked = checks?.slice(0, total).filter(Boolean).length ?? 0;
  const allDone = total > 0 && checked === total;
  const blocked = missingSteps.length > 0;
  const canAdvance = (allDone || completed) && !blocked;

  return (
    <section
      id="progression-check"
      aria-labelledby="progression-check-heading"
      className={[
        'overflow-hidden rounded-lg border bg-surface shadow-card',
        allDone || completed ? 'border-success/60' : 'border-success/40',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="flex items-start gap-2.5 p-4">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-success text-bg"
        >
          <ListChecks className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <h2
            id="progression-check-heading"
            className="text-base font-bold leading-snug text-text"
          >
            进阶条件
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            逐项自检，勾满即代表这一式过关。
          </p>
        </div>

        {completed ? (
          <span className="flex shrink-0 items-center gap-1 rounded-pill bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
            <Trophy aria-hidden="true" className="h-3.5 w-3.5" />
            已完成
          </span>
        ) : null}
      </header>

      <div className="px-4 pb-4">
        <ChecklistProgress checked={checked} total={total} />

        <Checklist
          className="mt-3.5"
          label={`${artName}第 ${stepNo} 式进阶条件`}
          goals={goals}
          checks={checks}
          onToggle={onToggle}
        />

      {/* 主行动按钮：勾满即点亮；已完成的显示「撤销」 */}
      <div className="mt-4 flex flex-col gap-2">
        {blocked ? (
          /*
            顺位门控提示。两种情形共用一块，但话不一样：
            - 本式还没完成 → 「先补完第 N 式」，按钮同时禁用（含「跳过条件」）；
            - 本式已完成但前面有断档 → 只提醒链条断了，不拦当前操作。
              这一支专门为**老数据**准备：v5 之前误触跳级会把进度写断
              （第 3 式已完成、1、2 式空白），不提示的话用户永远不知道断在哪。
            两种情形都给一条「回到第一个缺口」的链接，而不是只把按钮变灰。
          */
          <div className="rounded-md border border-violet/40 bg-violet-soft px-3 py-2.5">
            <p className="text-sm font-bold leading-snug text-violet">
              {completed
                ? `进度有断档：第 ${missingSteps.join('、')} 式还没完成`
                : `先补完第 ${missingSteps.join('、')} 式`}
            </p>
            <p className="mt-1 text-sm leading-[1.7] text-text">
              {completed ? (
                <>
                  第 {stepNo} 式已标记完成，但第 {missingSteps.join('、')} 式还空着 ——
                  六艺十式是线性阶梯，补上前面这几式，进度链才重新连续。
                </>
              ) : (
                <>
                  六艺十式是线性阶梯：第 {missingSteps[0]} 式还没标记完成，
                  所以第 {stepNo} 式暂时不能标记完成（「跳过条件」只跳质量要求，不跳顺位）。
                </>
              )}
            </p>
            {prerequisiteHref ? (
              <Link
                to={prerequisiteHref}
                className="mt-2.5 inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-violet bg-surface px-4 text-sm font-bold text-violet transition-colors hover:bg-violet-soft"
              >
                去完成第 {missingSteps[0]} 式
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        ) : null}

        {completed ? (
          <>
            <p className="rounded-md bg-success-soft px-3 py-2.5 text-sm font-semibold leading-relaxed text-success">
              {nextStepName
                ? `已进入第 ${stepNo + 1} 式「${nextStepName}」。向下滚动即可看到它的动作指导。`
                : `这是${artName}的最后一式，你已全部完成。`}
            </p>
            <Button variant="secondary" onClick={onUndo}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              撤销，退回到第 {stepNo} 式
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              onClick={onComplete}
              disabled={!canAdvance}
              aria-describedby={!canAdvance ? 'progression-hint' : undefined}
            >
              {nextStepName ? (
                <>
                  完成本式 · 进入第 {stepNo + 1} 式
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </>
              ) : (
                <>
                  完成本式 · 收尾这门艺
                  <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                </>
              )}
            </Button>

            {/* 被门控时不再重复给「跳过条件」—— 上面的提示块已经把该去哪说清了 */}
            {blocked ? null : !canAdvance ? (
              <>
                <p id="progression-hint" className="text-center text-xs text-muted">
                  还需勾选 {total - checked} 项才能进入下一式
                </p>
                <button
                  type="button"
                  onClick={onSkipComplete ?? onComplete}
                  className="mx-auto inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted underline-offset-4 hover:text-text hover:underline"
                >
                  跳过条件，直接标记完成
                </button>
              </>
            ) : (
              <p className="text-center text-xs font-semibold text-success">
                全部条件已确认，可以进入下一式了
              </p>
            )}
          </>
        )}
      </div>
      </div>
    </section>
  );
}
