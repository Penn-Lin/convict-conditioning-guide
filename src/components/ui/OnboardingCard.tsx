/**
 * OnboardingCard —— 首次使用引导（设计文档 §3.2）。
 *
 * 原则：**只问最小集合，绝不强制一次填一堆**。
 * 用户只回答三件事（每周几天 / 每次多久 / 自评水平），系统自行反推：
 * - 自评水平 → 六艺的初始 Step
 * - 每次多久 → 计划页的默认时间档
 * - 每周几天 → 周计划缺口因子（只影响项数，不参与打分）
 *
 * 逐项自报当前 Step / 能做的次数**是可选的**，并且可以跳过 —— 引导留白比填错好。
 */
import { useState } from 'react';
import { ChevronRight, Dumbbell, Timer, Users } from 'lucide-react';
import type { SelfLevel, SessionMinutes } from '@/types/plan';
import type { OnboardingAnswers } from '@/lib/plan/storage';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
const MINUTES_OPTIONS: SessionMinutes[] = [15, 30, 45, 60];

const LEVEL_OPTIONS: { value: SelfLevel; label: string; hint: string }[] = [
  { value: 'new', label: '完全新手', hint: '六艺都从第 1 式开始' },
  { value: 'some', label: '练过一阵', hint: '推 / 腿从第 2 式开始' },
  { value: 'trained', label: '有训练基础', hint: '按常见水平预设各艺式号' },
];

/** 分段选择按钮组（≥44px 触控目标） */
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={[
              'tnum min-h-[46px] min-w-[64px] rounded-md border px-3 text-sm font-bold transition-colors',
              active
                ? 'border-accent bg-accent text-bg'
                : 'border-border-strong bg-surface text-text hover:border-accent',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** `OnboardingCard` 的 props */
export interface OnboardingCardProps {
  onDone: (answers: OnboardingAnswers) => void;
}

/**
 * 首次使用引导卡。
 *
 * @example
 * <OnboardingCard onDone={completeOnboarding} />
 */
export function OnboardingCard({ onDone }: OnboardingCardProps) {
  const [daysPerWeek, setDaysPerWeek] = useState<(typeof DAYS_OPTIONS)[number]>(4);
  const [sessionMinutes, setSessionMinutes] = useState<SessionMinutes>(45);
  const [level, setLevel] = useState<SelfLevel>('some');

  return (
    <Card padding="lg">
      <p className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
        <Dumbbell aria-hidden="true" className="h-3.5 w-3.5" />
        开始前，先回答三个问题
      </p>

      <h2 className="mt-3 text-xl font-extrabold leading-tight text-text">
        默认你的训练节奏
      </h2>
      <p className="mt-2 text-base leading-[1.7] text-muted">
        只用来自动安排「今天练什么」。随时可以在下方改，不会锁死你的训练方式。
      </p>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <Users aria-hidden="true" className="h-4 w-4 text-accent" />
            每周大概训练几天
          </p>
          <div className="mt-2.5">
            <Segmented
              ariaLabel="每周训练天数"
              options={DAYS_OPTIONS.map((day) => ({ value: day, label: `${day} 天` }))}
              value={daysPerWeek}
              onChange={setDaysPerWeek}
            />
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-text">
            <Timer aria-hidden="true" className="h-4 w-4 text-accent" />
            每次通常有多少时间
          </p>
          <div className="mt-2.5">
            <Segmented
              ariaLabel="每次训练时长"
              options={MINUTES_OPTIONS.map((minute) => ({
                value: minute,
                label: `${minute} 分`,
              }))}
              value={sessionMinutes}
              onChange={setSessionMinutes}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-text">六艺目前的大致水平</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {LEVEL_OPTIONS.map((option) => {
              const active = option.value === level;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLevel(option.value)}
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
                    <span className="block text-base font-bold text-text">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        className="mt-5 w-full"
        size="lg"
        onClick={() =>
          onDone({ daysPerWeek, sessionMinutes, level, selfReport: {} })
        }
      >
        生成我的第一个训练计划
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Button>

      <p className="mt-2.5 text-center text-xs text-muted">
        当前式号随时可以在「六艺」里逐门调整，也可以直接进详情页打卡推进。
      </p>
    </Card>
  );
}
