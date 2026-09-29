/**
 * Checklist —— 进阶条件打勾清单（v2 核心交互）。
 *
 * 每一项都是 ≥44px 的触控行，点按即切换；勾满即代表「这一式过关」，
 * 底部主按钮随即点亮（`StepProgressCard` 负责那部分）。
 *
 * 可访问性：用真正的 `<input type="checkbox">` + 视觉代理（`sr-only` 隐藏原生控件），
 * 因此键盘 Tab / 空格、读屏、表单语义全部免费获得，不需要手写 `role="checkbox"`。
 */
import { Check } from 'lucide-react';
import type { ProgressionGoal } from '@/lib/checklist';
import { RichText } from '@/components/ui/RichText';

/** `Checklist` 的 props */
export interface ChecklistProps {
  goals: ProgressionGoal[];
  checks: boolean[] | undefined;
  onToggle: (index: number) => void;
  /** 无障碍分组名 */
  label?: string;
  className?: string;
  /** 是否只读（已完成的历史式展示用） */
  readOnly?: boolean;
}

/**
 * 进阶条件清单。
 *
 * @example
 * <Checklist goals={goals} checks={checks} onToggle={toggle} label="第 5 式进阶条件" />
 */
export function Checklist({
  goals,
  checks,
  onToggle,
  label = '进阶条件',
  className = '',
  readOnly = false,
}: ChecklistProps) {
  return (
    <ul
      aria-label={label}
      className={['flex flex-col gap-2', className].filter(Boolean).join(' ')}
    >
      {goals.map((goal) => {
        const checked = checks?.[goal.index] ?? false;
        return (
          <li key={goal.index}>
            <label
              className={[
                'flex min-h-12 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                checked
                  ? 'border-success/30 bg-success-soft'
                  : 'border-border bg-surface hover:border-border-strong',
                readOnly ? 'cursor-default' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={readOnly}
                onChange={() => {
                  if (!readOnly) onToggle(goal.index);
                }}
              />

              {/* 视觉代理：勾选态用「实心 + 对勾 + 底色」三重通道，不只靠颜色 */}
              <span
                aria-hidden="true"
                className={[
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors',
                  checked
                    ? 'animate-pop-check border-success bg-success text-white'
                    : 'border-border-strong bg-surface',
                ].join(' ')}
              >
                {checked ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs font-bold text-muted">
                    {goal.kind === 'quantity' ? '数量目标' : '质量要求'}
                  </span>
                  {checked ? (
                    <span className="text-xs font-bold text-success">已确认</span>
                  ) : null}
                </span>
                <RichText
                  as="span"
                  className="mt-0.5 block text-base leading-[1.65] text-text"
                  text={goal.text}
                />
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** 勾选进度条（清单上方的极简进度指示） */
export function ChecklistProgress({
  checked,
  total,
  className = '',
}: {
  checked: number;
  total: number;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((checked / total) * 100);

  return (
    <div className={['flex items-center gap-2.5', className].filter(Boolean).join(' ')}>
      <div
        role="progressbar"
        aria-valuenow={checked}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`进阶条件已完成 ${checked} 项，共 ${total} 项`}
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface2"
      >
        <div
          className="h-full rounded-pill bg-success transition-[width] duration-300 ease-smooth"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="tnum shrink-0 font-mono text-xs font-semibold text-muted">
        {checked}/{total}
      </span>
    </div>
  );
}
