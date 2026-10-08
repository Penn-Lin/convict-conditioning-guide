/**
 * LogSheet —— 「记录这次训练」抽屉（v3 · 动线收敛的核心）。
 *
 * ## 为什么要合并
 * v2 里「我做完了」这件事要在**两个页面各说一遍**：
 * - 动作详情页 → 勾选进阶条件（勾选式）
 * - 训练页 → 填每组次数 + 疲劳档（数字式）
 * 完成一次训练因此要 5 步、中间还要折返一次。
 *
 * v3 把两者合到**同一屏、同一项、同一次提交**：
 * 勾条件与填次数在同一个块里，一起填完一起交。动线收敛到 3 步、0 折返。
 *
 * ## 交互上的两个取舍（都为了「正常生活状态」）
 * - **每组次数默认预填目标值** —— 状态正常时一个数都不用改，直接提交；
 *   想细记的人再用 −/+ 调。训练完是又累又懒得操作的时候，粒度越细越会被整段跳过。
 * - **疲劳反馈只问一次**（训练结束后 4 档），不逐动作打分。
 *
 * ## 难度推进的确认点
 * 进阶条件**勾满**本身就代表用户确认了「这一式达标」。
 * 此时出现一个默认勾选的「完成后进入第 N+1 式」，取消勾选则只记录不推进 ——
 * 既满足「不要自动升级」，也不会多一次跳转。
 */
import { useMemo, useState } from 'react';
import { Check, Minus, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import type { ArtSlug } from '@/types';
import type { FatigueScore, PlanItem } from '@/types/plan';
import { getArt } from '@/data';
import { artTheme } from '@/lib/artTheme';
import { formatVolume } from '@/lib/plan/volumeLadder';
import { FATIGUE_BUTTONS } from '@/lib/plan/progression';
import { allChecked, checkedCount } from '@/lib/checklist';
import { useTraining } from '@/hooks/TrainingProvider';
import { useConfirm } from '@/hooks/useConfirm';
import type { SessionResult } from '@/hooks/useTrainingState';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Checklist, ChecklistProgress } from '@/components/ui/Checklist';

/** `LogSheet` 的 props */
export interface LogSheetProps {
  open: boolean;
  onClose: () => void;
  /** 今天计划里的项目（主训在前） */
  items: PlanItem[];
  /**
   * 提交回调：由调用方（训练页）负责写状态并拿到判定结果。
   * 抽屉只做「收集输入」，不碰状态写入 —— 这样提交后的判定结果能回到页面上展示。
   */
  onSubmit: (result: SessionResult, advanceSkills: ArtSlug[]) => void;
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
    <li className="flex items-center gap-2">
      <span className="tnum w-11 shrink-0 text-xs font-semibold text-muted">
        第 {index + 1} 组
      </span>

      <button
        type="button"
        aria-label={`第 ${index + 1} 组减少 ${step} ${unit}`}
        onClick={() => onChange(Math.max(0, value - step))}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-text active:scale-95"
      >
        <Minus aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      <span className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <span
          className={[
            'tnum font-mono text-base font-extrabold',
            reached ? 'text-success' : 'text-danger',
          ].join(' ')}
        >
          {value}
        </span>
        <span className="tnum text-xs text-muted">
          /{target} {unit}
        </span>
      </span>

      <button
        type="button"
        aria-label={`第 ${index + 1} 组增加 ${step} ${unit}`}
        onClick={() => onChange(value + step)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-text active:scale-95"
      >
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
      </button>

      <span className="w-5 shrink-0 text-center">
        {reached ? (
          <Check aria-hidden="true" className="mx-auto h-4 w-4 text-success" strokeWidth={3} />
        ) : null}
      </span>
    </li>
  );
}

/**
 * 训练记录抽屉。
 *
 * @example
 * <LogSheet open={open} onClose={close} items={items} />
 */
export function LogSheet({ open, onClose, items, onSubmit }: LogSheetProps) {
  const { store, goalsOf, toggleStepCheck, missingStepsOf } = useTraining();
  const confirm = useConfirm();

  /** 每组实际值，默认 = 目标值 */
  const initialActuals = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const item of items) {
      map[item.skill] = Array.from({ length: item.sets }, () => item.targetPerSet);
    }
    return map;
  }, [items]);

  const [actuals, setActuals] = useState<Record<string, number[]>>(initialActuals);
  const [fatigue, setFatigue] = useState<FatigueScore>(3);
  const [aborted, setAborted] = useState(false);
  /** 每一项「完成后是否推进到下一式」，默认推进 */
  const [advance, setAdvance] = useState<Record<string, boolean>>({});

  const setValue = (skill: string, setIndex: number, next: number) => {
    setActuals((prev) => {
      const list = [...(prev[skill] ?? [])];
      list[setIndex] = next;
      return { ...prev, [skill]: list };
    });
  };

  /** 本次提交会推进式号的项（受顺位门控约束） */
  const advanceItems = items.filter((item) => {
    if (advance[item.skill] === false) return false;
    // 前置式没完成 → 本次不推进（与 hooks 里 completeStep 的守卫同源）
    if (missingStepsOf(item.skill, item.stepNo).length > 0) return false;
    const goals = goalsOf(item.skill, item.stepNo);
    const checks = store.skills[item.skill].checks[item.stepNo];
    return allChecked(checks, goals.length);
  });

  const handleSubmit = async () => {
    /*
     * 二次确认（v5）。
     *
     * 这一步原先是一按即交：手机在训练完最累的时候操作，误触一次就把
     * 「难度推进」和「训练记录」一起写下去了 —— 而推进又会改变后续所有计划。
     * 这里把「会发生什么」摆出来再让用户按第二下；
     * `advanceItems` 为空时（只是记录、不推进）文案随之改成纯记录口径。
     */
    const ok = await confirm({
      title: advanceItems.length > 0 ? '提交记录，并推进到下一式？' : '提交这次训练记录？',
      description:
        advanceItems.length > 0
          ? `以下 ${advanceItems.length} 门的条件已勾满，提交后会进入下一式。`
          : '提交后会按完成度、疲劳与间隔重算明天的计划。',
      details:
        advanceItems.length > 0
          ? advanceItems.map((item) => {
              const next = getArt(item.skill)?.moves.find(
                (move) => move.stepNo === item.stepNo + 1,
              );
              return `${getArt(item.skill)?.nameZh ?? item.skill}：第 ${item.stepNo} 式已完成${next ? `，进入第 ${item.stepNo + 1} 式「${next.nameZh}」` : '，这是最后一式'}`;
            })
          : undefined,
      confirmLabel: advanceItems.length > 0 ? '确认提交并推进' : '确认提交',
      cancelLabel: '返回修改',
      tone: 'body',
    });
    if (!ok) return;

    onSubmit(
      {
        results: items.map((item) => ({
          skill: item.skill,
          actualPerSet: actuals[item.skill] ?? [],
          skipped: false,
        })),
        fatigue,
        aborted,
      },
      advanceItems.map((item) => item.skill),
    );

    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tone="body"
      title="记录这次训练"
      description="每组默认按目标值预填 —— 全部达标时直接选完状态提交即可。"
      footer={
        <div className="flex flex-col gap-2.5">
          <div>
            <p className="text-sm font-bold text-text">练完感觉怎么样？</p>
            <div role="radiogroup" aria-label="训练后疲劳反馈" className="mt-2 grid grid-cols-4 gap-1.5">
              {FATIGUE_BUTTONS.map((option) => {
                const active = option.score === fatigue;
                return (
                  <button
                    key={option.score}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFatigue(option.score)}
                    className={[
                      'min-h-[48px] rounded-md border px-1 text-xs font-bold transition-colors',
                      active
                        ? 'border-success bg-success text-bg'
                        : 'border-border-strong bg-surface text-text hover:border-success',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={() => { void handleSubmit(); }}>
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
            完成训练并记录
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        {items.map((item, index) => {
          const art = getArt(item.skill);
          const theme = artTheme(item.skill);
          const goals = goalsOf(item.skill, item.stepNo);
          const checks = store.skills[item.skill].checks[item.stepNo];
          const done = checkedCount(checks, goals.length);
          const satisfied = allChecked(checks, goals.length);
          const completed = store.skills[item.skill].completedSteps.includes(item.stepNo);
          const nextMove = art?.moves.find((move) => move.stepNo === item.stepNo + 1);
          const missing = missingStepsOf(item.skill, item.stepNo);
          const values = actuals[item.skill] ?? [];
          const reachedSets = values.filter((value) => value >= item.targetPerSet).length;

          return (
            <section
              key={item.skill}
              aria-label={`${item.nameZh} 的记录`}
              className="overflow-hidden rounded-lg border border-border bg-surface"
            >
              {/* 项目头 */}
              <header className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
                <span
                  className={[
                    'tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold',
                    theme.solid,
                  ].join(' ')}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-bold text-text">{item.nameZh}</span>
                    {item.challenge ? (
                      <span className="shrink-0 rounded-pill bg-violet px-1.5 py-0.5 text-[11px] font-bold text-bg">
                        进阶测试
                      </span>
                    ) : null}
                  </p>
                  <p className="tnum mt-0.5 truncate text-xs text-muted">
                    {art?.nameZh} · 第 {item.stepNo} 式 ·{' '}
                    {formatVolume(item.metric, item.sets, item.targetPerSet)}
                    {item.challenge ? '（原书高级标准）' : ''}
                  </p>
                </div>
                <span className="tnum shrink-0 text-xs font-semibold text-muted">
                  {reachedSets}/{item.sets} 组
                </span>
              </header>

              {/* 进阶条件 */}
              {goals.length > 0 ? (
                <div className="border-b border-border px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-text">进阶条件</p>
                    {completed ? (
                      <span className="rounded-pill bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                        本式已完成
                      </span>
                    ) : null}
                  </div>
                  <ChecklistProgress className="mt-2" checked={done} total={goals.length} />
                  <Checklist
                    className="mt-2.5"
                    label={`${item.nameZh} 进阶条件`}
                    goals={goals}
                    checks={checks}
                    onToggle={(goalIndex) =>
                      toggleStepCheck(item.skill, item.stepNo, goalIndex)
                    }
                    readOnly={completed}
                  />

                  {/* 勾满 → 出现默认勾选的推进确认；被顺位门控挡住时不出现，改为说明 */}
                  {satisfied && !completed && missing.length > 0 ? (
                    <p className="mt-3 rounded-md bg-surface2 px-3 py-2 text-xs leading-relaxed text-muted">
                      条件已勾满，但第 {missing.join('、')} 式还没标记完成 ——
                      顺位没跟上，本次<b className="text-text">只记录、不推进</b>。
                      去「{art?.nameZh}第 {missing[0]} 式」补打卡后再提交。
                    </p>
                  ) : satisfied && !completed ? (
                    <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md bg-success-soft px-3 py-2">
                      <input
                        type="checkbox"
                        checked={advance[item.skill] !== false}
                        onChange={(event) =>
                          setAdvance((prev) => ({
                            ...prev,
                            [item.skill]: event.target.checked,
                          }))
                        }
                        className="h-5 w-5 accent-success"
                      />
                      <span className="text-sm font-semibold leading-snug text-success">
                        {nextMove
                          ? `条件已勾满，提交后进入第 ${item.stepNo + 1} 式「${nextMove.nameZh}」`
                          : '条件已勾满，这是本门最后一式'}
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}

              {/* 逐组记录 */}
              <div className="px-3.5 py-3">
                <p className="text-xs font-bold text-text">逐组记录</p>
                <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
                  {Array.from({ length: item.sets }, (_, setIndex) => (
                    <SetRow
                      key={setIndex}
                      index={setIndex}
                      target={item.targetPerSet}
                      metric={item.metric}
                      value={values[setIndex] ?? item.targetPerSet}
                      onChange={(next) => setValue(item.skill, setIndex, next)}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        {/* 中途停止 */}
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-border px-3.5 py-2.5">
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

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet" />
          提交后会按你的完成度、疲劳与间隔重算明天的计划，并在训练页显示判定结果。
        </p>
      </div>
    </Sheet>
  );
}
