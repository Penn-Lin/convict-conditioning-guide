/**
 * AdjustSheet —— 「调整今天的计划」抽屉。
 *
 * 为什么收进抽屉：这些是**必须存在、但一天只用一次**的操作。
 * v2 把它们平铺在训练页底部，占了将近一屏，把真正的重点（训练清单）压了下去。
 *
 * 配色规则（照 `lib/tones.ts` 的原则落地）：
 * 每一组**平级选项**的按钮形状、尺寸、排布完全一致，只在「选中 / 未选中」上分色 ——
 * 这样「它们是一组」的联系由形状承担，颜色只负责回答「这是哪一个」。
 * 时间档四项同形同色（action 橙）；六艺 chips 同形但各带本门色相（标识是哪门艺）。
 */
import { Minus, Plus, RefreshCw, RotateCcw, Timer } from 'lucide-react';
import type { ArtSlug } from '@/types';
import type { DailyPlan, PlanOptions, SessionMinutes } from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import { getArt } from '@/data';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

const MINUTES_OPTIONS: SessionMinutes[] = [15, 30, 45, 60];

/** `AdjustSheet` 的 props */
export interface AdjustSheetProps {
  open: boolean;
  onClose: () => void;
  plan: DailyPlan;
  patchPlan: (patch: Partial<PlanOptions>) => void;
  resetPlanOptions: () => void;
}

/**
 * 调整抽屉。
 *
 * @example
 * <AdjustSheet open={open} onClose={close} plan={plan} patchPlan={patch} resetPlanOptions={reset} />
 */
export function AdjustSheet({
  open,
  onClose,
  plan,
  patchPlan,
  resetPlanOptions,
}: AdjustSheetProps) {
  const excludeSkills = plan.appliedOptions.excludeSkills ?? [];
  const scale = plan.appliedOptions.volumeScale ?? 1;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tone="action"
      title="调整今天的计划"
      description="任何调整都会重新走一遍完整规则计算，不会随机换一个动作。"
      footer={
        <Button className="w-full" size="lg" onClick={onClose}>
          完成
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pt-1">
        {/* ① 时间档 —— 平级四项，同形同色 */}
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <Timer aria-hidden="true" className="h-4 w-4 text-accent" />
            今天有多少时间
          </p>
          <div role="radiogroup" aria-label="今天可用时间" className="mt-2.5 grid grid-cols-4 gap-2">
            {MINUTES_OPTIONS.map((minutes) => {
              const active = minutes === plan.availableMinutes;
              return (
                <button
                  key={minutes}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patchPlan({ availableMinutes: minutes })}
                  className={[
                    'tnum min-h-[52px] rounded-md border text-sm font-bold transition-colors',
                    active
                      ? 'border-accent bg-accent text-bg'
                      : 'border-border-strong bg-surface text-text hover:border-accent',
                  ].join(' ')}
                >
                  {minutes}
                  <span className="ml-0.5 text-xs font-semibold">分</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ② 训练量 */}
        <div>
          <p className="text-sm font-bold text-text">训练量</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            只调整组数，单组次数由训练量阶梯决定、不轻易改动。
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={scale <= 0.6}
              onClick={() => patchPlan({ volumeScale: 0.6 })}
              className={[
                'flex min-h-[52px] items-center justify-center gap-1 rounded-md border text-sm font-bold transition-colors disabled:opacity-40',
                scale === 0.6
                  ? 'border-accent bg-accent text-bg'
                  : 'border-border-strong bg-surface text-text hover:border-accent',
              ].join(' ')}
            >
              <Minus aria-hidden="true" className="h-4 w-4" />
              减少
            </button>
            <button
              type="button"
              onClick={() => patchPlan({ volumeScale: 1 })}
              className={[
                'min-h-[52px] rounded-md border text-sm font-bold transition-colors',
                scale === 1
                  ? 'border-accent bg-accent text-bg'
                  : 'border-border-strong bg-surface text-text hover:border-accent',
              ].join(' ')}
            >
              默认
            </button>
            <button
              type="button"
              disabled={scale >= 1.2}
              onClick={() => patchPlan({ volumeScale: 1.2 })}
              className={[
                'flex min-h-[52px] items-center justify-center gap-1 rounded-md border text-sm font-bold transition-colors disabled:opacity-40',
                scale === 1.2
                  ? 'border-accent bg-accent text-bg'
                  : 'border-border-strong bg-surface text-text hover:border-accent',
              ].join(' ')}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              增加
            </button>
          </div>
        </div>

        {/* ③ 今天不想练哪门 —— 平级 chips，各带本门色相 */}
        <div>
          <p className="text-sm font-bold text-text">今天不想练哪门？</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            点一下即排除，系统会用同一套规则重新算剩下的项目。
          </p>
          <ul className="m-0 mt-2.5 grid list-none grid-cols-3 gap-2 p-0">
            {ART_ORDER.map((slug) => {
              const art = getArt(slug);
              const theme = artTheme(slug as ArtSlug);
              const excluded = excludeSkills.includes(slug);
              return (
                <li key={slug}>
                  <button
                    type="button"
                    aria-pressed={excluded}
                    onClick={() =>
                      patchPlan({
                        excludeSkills: excluded
                          ? excludeSkills.filter((item) => item !== slug)
                          : [...excludeSkills, slug],
                      })
                    }
                    className={[
                      'flex min-h-[46px] w-full items-center justify-center rounded-md border px-1 text-sm font-bold transition-colors',
                      excluded
                        ? 'border-danger/40 bg-danger-soft text-danger line-through'
                        : ['border-border-strong bg-surface hover:border-accent', theme.text].join(' '),
                    ].join(' ')}
                  >
                    {art?.nameZh ?? slug}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ④ 其他操作 */}
        <div className="flex flex-col gap-2.5 border-t border-border pt-5">
          {plan.main ? (
            <Button
              variant="secondary"
              onClick={() => patchPlan({ avoidMain: plan.main?.skill })}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              换一个方案
            </Button>
          ) : null}
          {plan.revision > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                resetPlanOptions();
                onClose();
              }}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              重置今天的全部调整
            </Button>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
