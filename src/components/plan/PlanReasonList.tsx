/**
 * PlanReasonList —— 「为什么今天练这些」（需求：计划必须能解释）。
 *
 * 引擎产出的 `PlanReason[]` 里每一条都带着**已填好真实数值的文案**，
 * 这里只负责按 `code` 选语义样式（绿 / 红 / 蓝 / 灰）并渲染 —— UI 不做任何文案拼装。
 *
 * 分组顺序刻意如此：你的调整 → 主训理由 → 辅助理由 → 时间与项数 → 没安排的项目。
 * 先讲「你改了什么」，再讲「所以变成了什么」。
 */
import { useState } from 'react';
import { ChevronDown, Info, Lightbulb, TriangleAlert, CheckCircle2 } from 'lucide-react';
import type { PlanReason, ReasonCode } from '@/types/plan';
import { getArt } from '@/data';
import type { NoteTone } from '@/components/ui/Card';

/** 语义代码 → 色调 */
const CODE_TONE: Partial<Record<ReasonCode, NoteTone>> = {
  RECOVERY_FULL: 'good',
  NEVER_TRAINED: 'info',
  RECOVERY_MODERATE: 'neutral',
  COMPLETION_HIGH: 'good',
  COMPLETION_LOW: 'risk',
  FATIGUE_HIGH: 'risk',
  OVERLAP_RECENT: 'risk',
  STALLED: 'risk',
  COMPLEMENT_MAIN: 'info',
  FOCUS_PRIMARY: 'good',
  TIME_BUDGET: 'neutral',
  WEEK_DEFICIT: 'info',
  USER_EXCLUDE: 'info',
  USER_ONLY: 'info',
  SETS_DELTA: 'info',
  TIER_FLOOR: 'info',
  PROGRESSION_READY: 'good',
  RECOVERY_DAY: 'info',
  SOFT_RETURN: 'risk',
};

/** 色调 → 图标 + 类名（完整字面量，供 JIT 扫描） */
const TONE_STYLE: Record<NoteTone, { Icon: typeof Info; iconClass: string }> = {
  good: { Icon: CheckCircle2, iconClass: 'text-success' },
  risk: { Icon: TriangleAlert, iconClass: 'text-danger' },
  info: { Icon: Info, iconClass: 'text-info' },
  neutral: { Icon: Lightbulb, iconClass: 'text-muted' },
};

/** `PlanReasonList` 的 props */
export interface PlanReasonListProps {
  reasons: PlanReason[];
  /** 默认是否展开 */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * 计划解释折叠面板。
 *
 * @example
 * <PlanReasonList reasons={plan.reasons} />
 */
export function PlanReasonList({
  reasons,
  defaultOpen = false,
  className = '',
}: PlanReasonListProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={[
        'overflow-hidden rounded-lg border border-violet/40 bg-surface shadow-card',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="plan-reasons-panel"
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-base font-bold text-text">
              为什么今天练这些
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {reasons.length} 条理由，全部由你的训练记录算出
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={[
              'h-5 w-5 shrink-0 text-muted transition-transform duration-200',
              open ? 'rotate-180' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </button>
      </h2>

      <div id="plan-reasons-panel" hidden={!open} className="px-4 pb-4">
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {reasons.map((reason, index) => {
            const tone = CODE_TONE[reason.code] ?? 'neutral';
            const { Icon, iconClass } = TONE_STYLE[tone];
            const art = reason.skill ? getArt(reason.skill) : undefined;

            return (
              <li key={`${reason.code}-${index}`} className="flex items-start gap-2.5">
                <Icon
                  aria-hidden="true"
                  className={['mt-1 h-4 w-4 shrink-0', iconClass].join(' ')}
                />
                <p className="min-w-0 flex-1 text-sm leading-[1.7] text-text">
                  {art ? (
                    <span className="mr-1 font-bold text-muted">
                      「{art.nameZh}」
                    </span>
                  ) : null}
                  {reason.text}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
