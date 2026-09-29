/**
 * Plan —— 今日训练计划页（v2 新增 · 需求 ③）。
 *
 * 页面结构（自上而下 = 用户决策的顺序）：
 * 1. 首次使用 → 引导卡；
 * 2. 今日概览：一句话摘要 + 「预计 X 分钟 / 你有 Y 分钟」；
 * 3. 时间档切换（15 / 30 / 45 / 60）；
 * 4. 主训 + 辅助训练列表（每项：练什么 / 练多少 / 为什么）；
 * 5. 主动调整：减少量 / 增加量 / 换方案 / 今天不想练某门 / 重置；
 * 6. 「为什么今天练这些」（引擎产出的完整理由）；
 * 7. 「今天没有安排」（含低优先级解释，透明度）；
 * 8. 加练自选池（时间有富余时）；
 * 9. 训练提示；
 * 10. 训练记录 → 反馈 → 判定结果（闭环）。
 *
 * 所有解释文案都由引擎生成（`plan.reasons`），页面只负责选样式与排版。
 */
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Dumbbell,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { ProgressionVerdict, SessionMinutes } from '@/types/plan';
import { ART_ORDER, MOVES_PER_ART, SITE_NAME } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import { formatDateCn, weekStart } from '@/lib/plan/time';
import { useDocumentMeta } from '@/lib/seo';
import { useTraining } from '@/hooks/TrainingProvider';
import { getArt } from '@/data';
import { ActionCard, Card, SemanticNote } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { OnboardingCard } from '@/components/ui/OnboardingCard';
import { PlanItemCard } from '@/components/plan/PlanItemCard';
import { PlanReasonList } from '@/components/plan/PlanReasonList';
import { SessionLogger } from '@/components/plan/SessionLogger';

const MINUTES_OPTIONS: SessionMinutes[] = [15, 30, 45, 60];

/** 周进度条（本周已练天数 / 目标天数） */
function WeekProgress({ daysPerWeek, trainedDates }: { daysPerWeek: number; trainedDates: string[] }) {
  return (
    <div className="flex items-center gap-3">
      <ProgressRing
        size="sm"
        value={Math.min(daysPerWeek, trainedDates.length)}
        total={daysPerWeek}
        label="本周训练进度"
      />
      <div className="min-w-0">
        <p className="text-sm font-bold text-text">本周训练</p>
        <p className="tnum mt-0.5 text-xs text-muted">
          已完成 {trainedDates.length} 天 / 目标 {daysPerWeek} 天
        </p>
      </div>
    </div>
  );
}

export function Plan() {
  useDocumentMeta(
    `今日训练计划 · ${SITE_NAME}`,
    '按恢复时间、训练完成度、疲劳与六艺负荷重叠动态生成今日训练计划，并给出「为什么今天练这些」的完整解释。',
  );

  const {
    ready,
    plan,
    today,
    store,
    patchPlan,
    persistPlan,
    resetPlanOptions,
    finishSession,
    completeOnboarding,
  } = useTraining();

  const [logging, setLogging] = useState(false);
  const [verdicts, setVerdicts] = useState<ProgressionVerdict[] | null>(null);

  // 进入计划页即把计划固化到存储 —— 训练过程中状态变化不会让计划漂移
  useEffect(() => {
    if (ready) persistPlan();
  }, [ready, persistPlan]);

  if (!ready || !plan) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-nav pt-6">
        <header className="mb-4">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text">
            今日训练计划
          </h1>
          <p className="mt-2 max-w-prose text-base leading-[1.75] text-muted">
            先花 20 秒做几个选择，之后每天打开就能直接看到「今天该练什么」。
          </p>
        </header>
        <OnboardingCard onDone={completeOnboarding} />
      </main>
    );
  }

  const items = [plan.main, ...plan.assists].filter(
    (item): item is NonNullable<typeof item> => item !== null,
  );
  const excludedSkills = plan.appliedOptions.excludeSkills ?? [];
  const scale = plan.appliedOptions.volumeScale ?? 1;
  const profile = store.profile!;

  /** 本周已训练的不同日期（周一为一周起点） */
  const weekStartDate = weekStart(today);
  const trainedDates = Array.from(
    new Set(
      store.sessions
        .filter(
          (session) =>
            session.state === 'done' &&
            session.date >= weekStartDate &&
            session.date <= today,
        )
        .map((session) => session.date),
    ),
  );

  const mainEntry = plan.main;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-nav pt-6">
      {/* 页头 */}
      <header>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Dumbbell aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight text-text">
              今日训练计划
            </h1>
            <p className="tnum flex items-center gap-1 text-xs text-muted">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              {formatDateCn(today)} · 第 {plan.revision + 1} 版
            </p>
          </div>
        </div>
      </header>

      {/* 概览卡 */}
      <ActionCard className="mt-4" padding="lg">
        <div className="flex items-start gap-4">
          <ProgressRing
            size="md"
            value={plan.totalEstimatedMinutes}
            total={plan.availableMinutes}
            label={`今日计划预计耗时 ${plan.totalEstimatedMinutes} 分钟`}
          >
            <span className="flex items-baseline gap-0.5">
              <span className="tnum font-mono text-base font-bold">
                {plan.totalEstimatedMinutes}
              </span>
              <span className="text-[10px] text-muted">分</span>
            </span>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-accent">
              {plan.kind === 'recovery' ? '今天建议恢复' : '今天练这些'}
            </p>
            <p className="mt-1 text-base font-semibold leading-[1.6] text-text">
              {plan.summary}
            </p>
            <p className="tnum mt-1.5 text-xs text-muted">
              计划约 {plan.totalEstimatedMinutes} 分钟 · 你有 {plan.availableMinutes}{' '}
              分钟 · 剩余 {plan.freeMinutes} 分钟
            </p>
          </div>
        </div>

        {mainEntry ? (
          <p className="mt-3.5 rounded-md bg-surface/70 px-3 py-2.5 text-sm leading-[1.7] text-muted">
            <span className="font-bold text-text">训练不填满时间是刻意的</span>
            —— 原书训练量本就是短时段、低组数、不练到力竭。剩余时间请用于热身（约 5
            分钟）与拉伸，而不是硬凑组数。
          </p>
        ) : null}
      </ActionCard>

      {/* 时间档切换 */}
      <Card className="mt-3.5" padding="md">
        <p className="flex items-center gap-1.5 text-sm font-bold text-text">
          <Timer aria-hidden="true" className="h-4 w-4 text-accent" />
          今天有多少时间
        </p>
        <div
          role="radiogroup"
          aria-label="今天可用时间"
          className="mt-2.5 flex flex-wrap gap-2"
        >
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
                  'tnum min-h-[46px] min-w-[72px] rounded-md border px-3 text-sm font-bold transition-colors',
                  active
                    ? 'border-accent bg-accent text-bg'
                    : 'border-border-strong bg-surface text-text hover:border-accent',
                ].join(' ')}
              >
                {minutes} 分
              </button>
            );
          })}
        </div>
      </Card>

      {/* 训练记录结果（闭环反馈） */}
      {verdicts && verdicts.length > 0 ? (
        <SemanticNote className="mt-3.5" tone="info" title="训练已记录">
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {verdicts.map((verdict, index) => (
              <li key={index} className="text-sm leading-[1.7] text-text">
                {verdict.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            今日计划已按新状态重算；难度变更需要你确认，不会自动跳级。
          </p>
        </SemanticNote>
      ) : null}

      {/* 计划项 */}
      {plan.kind === 'recovery' ? (
        <SemanticNote className="mt-3.5" tone="good" title="今天休息">
          <p className="text-sm leading-[1.7] text-text">
            今天没有合适的训练项目。恢复也是训练的一部分 —— 走一走、拉伸一下，
            或者干脆休息。想练点什么的话，清空下方排除项即可重算。
          </p>
        </SemanticNote>
      ) : (
        <section aria-labelledby="plan-items-heading" className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="plan-items-heading" className="text-lg font-bold text-text">
              训练清单
            </h2>
            <span className="tnum font-mono text-sm font-semibold text-muted">
              {items.length} 项
            </span>
          </div>
          <ul className="mt-3.5 flex list-none flex-col gap-3 p-0">
            {items.map((item, index) => (
              <li key={item.skill}>
                <PlanItemCard item={item} index={index + 1} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 主动调整 */}
      <Card className="mt-3.5" padding="md">
        <h2 className="text-base font-bold text-text">调整今天的计划</h2>
        <p className="mt-1 text-sm text-muted">
          任何调整都会重新走一遍完整规则计算，不会随机换一个动作。
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => patchPlan({ volumeScale: 0.6 })}
            disabled={scale <= 0.6}
          >
            <Minus aria-hidden="true" className="h-4 w-4" />
            减少训练量
          </Button>
          <Button
            variant="secondary"
            onClick={() => patchPlan({ volumeScale: 1.2 })}
            disabled={scale >= 1.2}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            增加训练量
          </Button>
          {mainEntry ? (
            <Button
              variant="secondary"
              onClick={() => patchPlan({ avoidMain: mainEntry.skill })}
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              换一个方案
            </Button>
          ) : null}
          {plan.revision > 0 ? (
            <Button variant="ghost" onClick={resetPlanOptions}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              重置今天的调整
            </Button>
          ) : null}
        </div>

        {/* 今天不想练 */}
        <p className="mt-4 text-sm font-bold text-text">今天不想练哪门？</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ART_ORDER.map((slug) => {
            const art = getArt(slug);
            const theme = artTheme(slug);
            const active = excludedSkills.includes(slug);
            return (
              <button
                key={slug}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  patchPlan({
                    excludeSkills: active
                      ? excludedSkills.filter((item) => item !== slug)
                      : [...excludedSkills, slug],
                  })
                }
                className={[
                  'min-h-[44px] rounded-pill border px-3.5 text-sm font-semibold transition-colors',
                  active
                    ? 'border-danger/40 bg-danger-soft text-danger line-through'
                    : ['border-border-strong bg-surface text-text hover:border-accent', theme.text].join(' '),
                ].join(' ')}
              >
                {art?.nameZh ?? slug}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 为什么今天练这些 */}
      <PlanReasonList className="mt-3.5" reasons={plan.reasons} />

      {/* 加练自选池 */}
      {plan.optional.length > 0 ? (
        <section aria-labelledby="plan-optional-heading" className="mt-3.5">
          <Card padding="md">
            <h2
              id="plan-optional-heading"
              className="flex items-center gap-1.5 text-base font-bold text-text"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4 text-info" />
              加练自选
            </h2>
            <p className="mt-1 text-sm text-muted">
              时间有富余、状态也不错时才考虑。不做也完全没问题 —— 它们不在计划内。
            </p>
            <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {plan.optional.map((item, index) => (
                <li key={item.skill}>
                  <PlanItemCard item={item} index={items.length + index + 1} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      {/* 训练提示 */}
      {plan.tips.length > 0 ? (
        <Card className="mt-3.5" padding="md">
          <h2 className="text-base font-bold text-text">训练提示</h2>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {plan.tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-sm leading-[1.7] text-muted">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-accent" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* 训练记录 */}
      {plan.kind === 'training' ? (
        logging ? (
          <SessionLogger
            className="mt-3.5"
            items={items}
            onCancel={() => setLogging(false)}
            onSubmit={(result) => {
              const next = finishSession(result);
              setVerdicts(next);
              setLogging(false);
            }}
          />
        ) : (
          <div className="mt-3.5">
            <Button className="w-full" size="lg" onClick={() => setLogging(true)}>
              开始训练 · 记录完成情况
            </Button>
          </div>
        )
      ) : null}

      {/* 我的设置 */}
      <Card className="mt-6" padding="lg">
        <h2 className="text-base font-bold text-text">我的训练设置</h2>

        <div className="mt-3.5">
          <WeekProgress daysPerWeek={profile.onboarding.daysPerWeek} trainedDates={trainedDates} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-surface2 p-3">
            <dt className="text-xs text-muted">每周目标</dt>
            <dd className="tnum mt-0.5 font-mono font-bold text-text">
              {profile.onboarding.daysPerWeek} 天
            </dd>
          </div>
          <div className="rounded-md bg-surface2 p-3">
            <dt className="text-xs text-muted">默认时长</dt>
            <dd className="tnum mt-0.5 font-mono font-bold text-text">
              {profile.onboarding.sessionMinutes} 分钟
            </dd>
          </div>
          <div className="rounded-md bg-surface2 p-3">
            <dt className="text-xs text-muted">已记录训练</dt>
            <dd className="tnum mt-0.5 font-mono font-bold text-text">
              {store.sessions.length} 次
            </dd>
          </div>
          <div className="rounded-md bg-surface2 p-3">
            <dt className="text-xs text-muted">六艺总进度</dt>
            <dd className="tnum mt-0.5 font-mono font-bold text-text">
              {ART_ORDER.reduce(
                (sum, slug) =>
                  sum + Math.min(MOVES_PER_ART, store.skills[slug].completedSteps.length),
                0,
              )}
              /{ART_ORDER.length * MOVES_PER_ART}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          所有数据只存在这台设备的浏览器里，不上传服务器；清除浏览器数据会一并清空。
        </p>
      </Card>
    </main>
  );
}

export default Plan;
