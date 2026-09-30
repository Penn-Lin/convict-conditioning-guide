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
import { CalendarRange, Layers, Minus, Plus, RefreshCw, RotateCcw, Sparkles, Timer } from 'lucide-react';
import type { ArtSlug } from '@/types';
import type { DailyPlan, PlanOptions, ScheduleMode, SessionMinutes } from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import { getArt } from '@/data';
import { MINUTE_BUDGET, TEXTBOOK_PLANS, TIER_NAME_CN, tierLabel } from '@/lib/plan/config';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

const MINUTES_OPTIONS: SessionMinutes[] = [15, 30, 45, 60];

/** 排期模式三选一（顺序即展示顺序） */
const SCHEDULE_OPTIONS: readonly {
  value: ScheduleMode;
  label: string;
  hint: string;
}[] = [
  {
    value: 'textbook-steady',
    label: TEXTBOOK_PLANS['textbook-steady'].name,
    hint: `${TEXTBOOK_PLANS['textbook-steady'].tagline} · 原书推荐`,
  },
  {
    value: 'textbook-beginner',
    label: TEXTBOOK_PLANS['textbook-beginner'].name,
    hint: TEXTBOOK_PLANS['textbook-beginner'].tagline,
  },
  {
    value: 'auto',
    label: '自动调度',
    hint: '按恢复、疲劳与负荷重叠每天重算',
  },
];

/** 训练量档三选一（0 初级 / 1 中级 / 2 升阶） */
const TIER_OPTIONS = [0, 1, 2] as const;

/** 各档的通俗说明（直接抄原书第十一章的立场，不做发挥） */
const TIER_HINT: Record<number, string> = {
  0: '1 组。原书里的起步门槛，刚换到新一式的头几次用它。',
  1: '2 组。原书说「我通常建议练习两组」—— 这才是日常训练量。',
  2: '2–3 组（按该式阶梯）。准备冲下一式时用。',
};

/** `AdjustSheet` 的 props */
export interface AdjustSheetProps {
  open: boolean;
  onClose: () => void;
  plan: DailyPlan;
  patchPlan: (patch: Partial<PlanOptions>) => void;
  resetPlanOptions: () => void;
  /** 当前生效的排期模式（当天指定 > 档案偏好 > auto） */
  scheduleMode: ScheduleMode;
  /** 切换**长期**排期模式（写回档案，不只是今天） */
  onScheduleModeChange: (mode: ScheduleMode) => void;
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
  scheduleMode,
  onScheduleModeChange,
}: AdjustSheetProps) {
  const excludeSkills = plan.appliedOptions.excludeSkills ?? [];
  const delta = plan.appliedOptions.setsDelta ?? 0;
  const override = plan.appliedOptions.volumeTierOverride;

  /** 今天实际用到的档位（各门可能不同，取集合用于显示） */
  const activeTiers = Array.from(
    new Set(
      [plan.main, ...plan.assists]
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map((item) => item.volumeTier),
    ),
  ).sort();
  const activeTierText =
    activeTiers.length === 0
      ? '—'
      : activeTiers.length === 1
        ? tierLabel(activeTiers[0])
        : activeTiers.map((tier) => tierLabel(tier)).join(' / ');

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
        {/* ① 训练安排方式 —— 决定「今天练哪几门」，是最上层的一个开关 */}
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <CalendarRange aria-hidden="true" className="h-4 w-4 text-accent" />
            训练安排方式
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            决定「今天练哪几门」。<b>长期设置</b>，改一次之后每天都按它排，不是只影响今天。
          </p>
          <div role="radiogroup" aria-label="训练安排方式" className="mt-2.5 flex flex-col gap-2">
            {SCHEDULE_OPTIONS.map((option) => {
              const active = option.value === scheduleMode;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onScheduleModeChange(option.value)}
                  className={[
                    'flex min-h-[52px] items-center gap-3 rounded-md border p-3 text-left transition-colors',
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-surface hover:border-border-strong',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2',
                      active ? 'border-accent' : 'border-border-strong',
                    ].join(' ')}
                  >
                    {active ? <span className="h-2.5 w-2.5 rounded-pill bg-accent" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-text">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {option.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {scheduleMode !== 'auto' ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
              <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" />
              原书模板下科目由清单固定，与星期几无关：距上次训练满 2 天的科目今天就会排进来。
              隔天练时六门全部到期，所以每次都是全练。
            </p>
          ) : null}
        </div>

        {/* ② 时间档 —— 平级四项，同形同色 */}
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
                  onClick={() =>
                    // 改时间档同时清掉手动的档位指定：时间档自带档位下限，
                    // 两者叠加会让「选 15 分钟却按升阶档练」这种组合出现。
                    patchPlan({ availableMinutes: minutes, volumeTierOverride: undefined })
                  }
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

        {/* ③ 训练量微调（±1 组） */}
        <div>
          <p className="text-sm font-bold text-text">训练量</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            在上面的档位基础上，<b>每一项各加减一组</b>。单组次数永远不动
            （它由原书训练量阶梯决定）。想粗调就用档位，想细调就用这里。
          </p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={delta <= -1}
              onClick={() => patchPlan({ setsDelta: -1 })}
              className={[
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-md border text-sm font-bold transition-colors disabled:opacity-40',
                delta === -1
                  ? 'border-accent bg-accent text-bg'
                  : 'border-border-strong bg-surface text-text hover:border-accent',
              ].join(' ')}
            >
              <span className="flex items-center gap-1">
                <Minus aria-hidden="true" className="h-4 w-4" />
                减一组
              </span>
              <span className="text-[11px] font-semibold opacity-80">组数 −1</span>
            </button>
            <button
              type="button"
              onClick={() => patchPlan({ setsDelta: 0 })}
              className={[
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-md border text-sm font-bold transition-colors',
                delta === 0
                  ? 'border-accent bg-accent text-bg'
                  : 'border-border-strong bg-surface text-text hover:border-accent',
              ].join(' ')}
            >
              <span>档位标准</span>
              <span className="text-[11px] font-semibold opacity-80">不加不减</span>
            </button>
            <button
              type="button"
              disabled={delta >= 1}
              onClick={() => patchPlan({ setsDelta: 1 })}
              className={[
                'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-md border text-sm font-bold transition-colors disabled:opacity-40',
                delta === 1
                  ? 'border-accent bg-accent text-bg'
                  : 'border-border-strong bg-surface text-text hover:border-accent',
              ].join(' ')}
            >
              <span className="flex items-center gap-1">
                <Plus aria-hidden="true" className="h-4 w-4" />
                加一组
              </span>
              <span className="text-[11px] font-semibold opacity-80">组数 +1</span>
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            上限 4 组（原书：「三组甚至四组也可以接受」）。要真正提升训练量，
            更该做的是把<b>档位</b>往上调一档，或干脆用更长的时间档。
          </p>
        </div>

        {/* ④ 今天的训练量档 —— 三选一 + 自动 */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <p className="flex items-center gap-1.5 text-sm font-bold text-text">
              <Layers aria-hidden="true" className="h-4 w-4 text-accent" />
              今天的训练量档
            </p>
            <p className="text-xs text-muted">
              当前 <span className="font-semibold text-text">{activeTierText}</span>
            </p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            档位来自原书每一式的「初级 / 中级 / 升阶标准」，指的是做几组。
            不指定时自动取「你在这一门上的长期进度」与「时间档给的底线」里较高的那个
            （{plan.availableMinutes} 分钟档的底线是
            {tierLabel(MINUTE_BUDGET[plan.availableMinutes].tierFloor)}）。
          </p>
          <div role="radiogroup" aria-label="今天的训练量档" className="mt-2.5 grid grid-cols-3 gap-2">
            {TIER_OPTIONS.map((tier) => {
              const active = override === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => patchPlan({ volumeTierOverride: tier })}
                  className={[
                    'min-h-[52px] rounded-md border text-sm font-bold transition-colors',
                    active
                      ? 'border-accent bg-accent text-bg'
                      : 'border-border-strong bg-surface text-text hover:border-accent',
                  ].join(' ')}
                >
                  {TIER_NAME_CN[tier]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {override === undefined
              ? `自动：按各门自己的进度来，不低于时间档底线。${TIER_HINT[1]}`
              : TIER_HINT[override]}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            想试更高档不用等系统批准 —— 直接选，练完照常按完成度判定；
            做不到只影响今天的记录，不会改掉长期进度。
          </p>
          {override !== undefined ? (
            <button
              type="button"
              onClick={() => patchPlan({ volumeTierOverride: undefined })}
              className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-accent underline-offset-2 hover:underline"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              恢复自动
            </button>
          ) : null}
        </div>

        {/* ⑤ 今天不想练哪门 —— 平级 chips，各带本门色相 */}
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

        {/* ⑥ 其他操作 */}
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
