/**
 * SessionLogger —— 训练执行与反馈闭环（需求 ⑩）。
 *
 * 闭环：**计划 → 训练 → 记录 → 更新状态 → 下一次计划**。
 *
 * 交互取舍（「尽量适合正常生活状态」）：
 * - 每组实际次数**默认预填为目标值**，一次点击即可直接提交 —— 状态正常时不用点十几下；
 * - 想细记的人可以逐组用 − / + 调整；
 * - 疲劳反馈只要**一次 4 档选择**（状态很好 / 状态不错 / 正常 / 很累），
 *   而不是逐动作打分 —— 训练完是又累又懒得操作的时候，粒度越细越会被跳过。
 */
import { useMemo, useState } from 'react';
import { Check, Minus, Plus, TriangleAlert } from 'lucide-react';
import type { FatigueScore, PlanItem } from '@/types/plan';
import { getArt } from '@/data';
import { formatVolume } from '@/lib/plan/volumeLadder';
import { FATIGUE_BUTTONS } from '@/lib/plan/progression';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { SessionResult } from '@/hooks/useTrainingState';

/** `SessionLogger` 的 props */
export interface SessionLoggerProps {
  items: PlanItem[];
  onSubmit: (result: SessionResult) => void;
  onCancel?: () => void;
  className?: string;
}

/** 单组输入行 */
function SetRow({
  index,
  target,
  metric,
  value,
  onChange,
}: {
  index: number;
  target: number;
  metric: PlanItem['metric'];
  value: number;
  onChange: (next: number) => void;
}) {
  const step = metric === 'hold' ? 5 : 1;
  const unit = metric === 'hold' ? '秒' : '次';
  const reached = value >= target;

  return (
    <li className="flex items-center gap-2.5">
      <span className="tnum w-12 shrink-0 text-sm font-semibold text-muted">
        第 {index + 1} 组
      </span>

      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          aria-label={`第 ${index + 1} 组减少 ${step} ${unit}`}
          onClick={() => onChange(Math.max(0, value - step))}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-text active:scale-95"
        >
          <Minus aria-hidden="true" className="h-4 w-4" />
        </button>

        <span className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <span
            className={[
              'tnum font-mono text-lg font-extrabold',
              reached ? 'text-success' : 'text-danger',
            ].join(' ')}
          >
            {value}
          </span>
          <span className="text-xs text-muted">
            / {target} {unit}
          </span>
        </span>

        <button
          type="button"
          aria-label={`第 ${index + 1} 组增加 ${step} ${unit}`}
          onClick={() => onChange(value + step)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-text active:scale-95"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <span className="w-6 shrink-0 text-center">
        {reached ? (
          <Check aria-hidden="true" className="mx-auto h-4 w-4 text-success" strokeWidth={3} />
        ) : null}
      </span>
    </li>
  );
}

/**
 * 训练记录面板。
 *
 * @example
 * <SessionLogger items={items} onSubmit={finishSession} />
 */
export function SessionLogger({
  items,
  onSubmit,
  onCancel,
  className = '',
}: SessionLoggerProps) {
  /** 每组实际值，默认 = 目标值 */
  const initial = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const item of items) {
      map[item.skill] = Array.from({ length: item.sets }, () => item.targetPerSet);
    }
    return map;
  }, [items]);

  const [actuals, setActuals] = useState<Record<string, number[]>>(initial);
  const [fatigue, setFatigue] = useState<FatigueScore>(3);
  const [aborted, setAborted] = useState(false);

  const setValue = (skill: string, setIndex: number, next: number) => {
    setActuals((prev) => {
      const list = [...(prev[skill] ?? [])];
      list[setIndex] = next;
      return { ...prev, [skill]: list };
    });
  };

  const handleSubmit = () => {
    onSubmit({
      results: items.map((item) => ({
        skill: item.skill,
        actualPerSet: actuals[item.skill] ?? [],
        skipped: false,
      })),
      fatigue,
      aborted,
    });
  };

  return (
    <Card className={className} padding="lg">
      <h2 className="text-lg font-extrabold leading-tight text-text">记录这次训练</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        每组默认按目标值预填。全部达标时，直接选完状态提交即可；有差距的再调整。
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {items.map((item) => {
          const art = getArt(item.skill);
          const values = actuals[item.skill] ?? [];
          const doneCount = values.filter((value) => value >= item.targetPerSet).length;

          return (
            <div key={item.skill}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 text-base font-bold text-text">
                  {item.nameZh}
                  <span className="ml-1.5 text-sm font-medium text-muted">
                    {art?.nameZh} · {formatVolume(item.metric, item.sets, item.targetPerSet)}
                  </span>
                </p>
                <span className="tnum shrink-0 text-xs font-semibold text-muted">
                  达标 {doneCount}/{item.sets} 组
                </span>
              </div>

              <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
                {Array.from({ length: item.sets }, (_, index) => (
                  <SetRow
                    key={index}
                    index={index}
                    target={item.targetPerSet}
                    metric={item.metric}
                    value={values[index] ?? item.targetPerSet}
                    onChange={(next) => setValue(item.skill, index, next)}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* 疲劳反馈：一次 4 档 */}
      <fieldset className="mt-6 border-0 p-0">
        <legend className="text-base font-bold text-text">练完感觉怎么样？</legend>
        <p className="mt-1 text-sm text-muted">
          这一项会决定明天要不要给你加量、以及哪些项目该往后放。
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {FATIGUE_BUTTONS.map((option) => {
            const active = option.score === fatigue;
            return (
              <button
                key={option.score}
                type="button"
                aria-pressed={active}
                onClick={() => setFatigue(option.score)}
                className={[
                  'min-h-[52px] rounded-md border px-3 text-sm font-bold transition-colors',
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
      </fieldset>

      {/* 中途停止 */}
      <label className="mt-5 flex min-h-11 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={aborted}
          onChange={(event) => setAborted(event.target.checked)}
          className="h-5 w-5 accent-danger"
        />
        <span className="flex items-center gap-1.5 text-sm font-medium text-text">
          <TriangleAlert aria-hidden="true" className="h-4 w-4 text-danger" />
          中途停止（体力不支 / 时间不够 / 疼痛）
        </span>
      </label>

      <div className="mt-4 flex flex-col gap-2.5">
        <Button size="lg" onClick={handleSubmit}>
          <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
          完成训练并记录
        </Button>
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            先不记，返回计划
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
