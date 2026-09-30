/**
 * Plan —— 训练页（v3）。
 *
 * ## 这一版的职责
 * **把首页的摘要展开成可执行的动作，并把所有操作收在一处。**
 * 首页只回答「今天大概要做什么」，这里回答「具体每一项怎么做、怎么记、怎么调」。
 *
 * ## v2 → v3 的两个改动
 * 1. **操作收进抽屉**。「调整今天的计划」（时间档 / 排除某门 / 加减量 / 换方案）与
 *    「记录训练」都从常驻区块改为抽屉 —— 它们一天只用一次，常驻会把主屏淹掉。
 *    主屏因此只剩「今天的清单 + 一个开始按钮」。
 * 2. **打卡与记录合并**。逐组次数与进阶条件在同一屏、同一次提交里说完，
 *    不再需要「去动作详情页勾条件 → 折返回来填次数」。
 *
 * ## 板块与色调（见 `lib/tones.ts`）
 * 今天=action 橙 / 判定结果=data 蓝 / 解释=guide 紫 / 本周=data 蓝 / 设置=neutral 灰。
 * 色调只回答「这是哪一类信息」，轻重由底色强度（variant）承担。
 */
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Info,
  Lightbulb,
  ListChecks,
  Rocket,
  Settings2,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import type { ProgressionVerdict } from '@/types/plan';
import { ART_ORDER, MOVES_PER_ART, SITE_NAME } from '@/lib/constants';
import { formatDateCn, weekStart } from '@/lib/plan/time';
import { useDocumentMeta } from '@/lib/seo';
import { useTraining } from '@/hooks/TrainingProvider';

import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { OnboardingCard } from '@/components/ui/OnboardingCard';
import { PlanItemCard } from '@/components/plan/PlanItemCard';
import { PlanReasonList } from '@/components/plan/PlanReasonList';
import { AdjustSheet } from '@/components/plan/AdjustSheet';
import { LogSheet } from '@/components/plan/LogSheet';

export function Plan() {
  useDocumentMeta(
    `今日训练计划 · ${SITE_NAME}`,
    '按恢复时间、训练完成度、疲劳与六艺负荷重叠动态生成今日训练计划，支持调整、逐组记录与训练后反馈，并给出完整解释。',
  );

  const {
    ready,
    plan,
    today,
    store,
    patchPlan,
    persistPlan,
    resetPlanOptions,
    completeOnboarding,
    finishSession,
    completeStep,
  } = useTraining();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [verdicts, setVerdicts] = useState<ProgressionVerdict[] | null>(null);

  // 进入训练页即把计划固化，避免训练过程中状态变化让计划漂移
  useEffect(() => {
    if (ready) persistPlan();
  }, [ready, persistPlan]);

  if (!ready || !plan) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-nav pt-5">
        <header className="mb-4">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text">
            训练
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

  /* ---- 时间账（热身 + 训练 + 放松）---- */
  const sessionMinutes =
    Math.round(
      (plan.warmupMinutes + plan.totalEstimatedMinutes + plan.cooldownMinutes) * 10,
    ) / 10;

  /* ---- 本周 ---- */
  const weekStartDate = weekStart(today);
  const weekDays = new Set(
    store.sessions
      .filter(
        (session) =>
          session.state === 'done' &&
          session.date >= weekStartDate &&
          session.date <= today,
      )
      .map((session) => session.date),
  ).size;
  const daysPerWeek = store.profile?.onboarding.daysPerWeek ?? 4;
  const totalDone = ART_ORDER.reduce(
    (sum, slug) => sum + Math.min(MOVES_PER_ART, store.skills[slug].completedSteps.length),
    0,
  );
  const totalMoves = ART_ORDER.length * MOVES_PER_ART;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-nav pt-5">
      {/* 页头 */}
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text">
          训练
        </h1>
        <p className="tnum mt-1 flex items-center gap-1.5 text-xs text-muted">
          <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
          {formatDateCn(today)}
          {plan.revision > 0 ? ` · 已调整 ${plan.revision} 次` : ''}
        </p>
      </header>

      {/* 提交后的判定结果 */}
      {verdicts && verdicts.length > 0 ? (
        <Section
          className="mb-4"
          as="div"
          tone="data"
          variant="tinted"
          icon={CheckCircle2}
          title="训练已记录"
        >
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {verdicts.map((verdict, index) => (
              <li key={index} className="flex gap-2 text-sm leading-[1.7] text-text">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-info" />
                <span className="min-w-0">{verdict.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            难度变更需要你确认，不会自动跳级。今天的计划已按新状态重算。
          </p>
        </Section>
      ) : null}

      {/* ① 今天 —— 主板块 */}
      <Section
        as="div"
        tone="action"
        variant="tinted"
        icon={Dumbbell}
        title="今天练这些"
        meta={plan.kind === 'training' ? `约 ${sessionMinutes} 分钟` : undefined}
        action={
          <button
            type="button"
            onClick={() => setAdjustOpen(true)}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-surface px-2.5 text-xs font-bold text-accent transition-colors hover:bg-accent-soft"
          >
            <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
            调整
          </button>
        }
      >
        {plan.kind === 'recovery' || items.length === 0 ? (
          <div>
            <p className="text-base font-bold text-text">今天建议安排恢复</p>
            <p className="mt-1.5 text-sm leading-[1.7] text-muted">
              今天没有合适的训练项目。恢复也是训练的一部分 —— 走一走、拉伸一下，
              或者干脆休息。想练点什么的话，点右上角「调整」清空排除项即可重算。
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted">{plan.summary}</p>

            {/* 时间账：把热身 / 训练 / 放松三行摊开，杜绝「剩 50 分钟去热身」式结论 */}
            <dl className="mt-3 grid grid-cols-4 gap-1.5">
              {[
                { label: '热身', value: plan.warmupMinutes, unit: '分' },
                { label: '训练', value: plan.totalEstimatedMinutes, unit: '分' },
                { label: '放松', value: plan.cooldownMinutes, unit: '分' },
                { label: '余量', value: plan.freeMinutes, unit: '分' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-md bg-surface2 px-2 py-1.5 text-center">
                  <dt className="text-[11px] text-muted">{cell.label}</dt>
                  <dd className="tnum mt-0.5 font-mono text-sm font-bold text-text">
                    {cell.value}
                    <span className="ml-0.5 text-[11px] font-semibold text-muted">
                      {cell.unit}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              你的时间档是 {plan.availableMinutes} 分钟。热身按原书做法用低难度版本做两组，
              约 3 分钟即可，不必更长。
            </p>

            <ul className="m-0 mt-3.5 flex list-none flex-col gap-3 p-0">
              {items.map((item, index) => (
                <li key={item.skill}>
                  <PlanItemCard item={item} index={index + 1} />
                </li>
              ))}
            </ul>

            <Button className="mt-4 w-full" size="lg" onClick={() => setLogOpen(true)}>
              <ListChecks aria-hidden="true" className="h-4 w-4" />
              开始训练 · 记录完成情况
            </Button>

            <p className="mt-2.5 text-center text-xs leading-relaxed text-muted">
              记录时每组默认按目标值预填，逐组可改；进阶条件在同一屏勾选。
            </p>
          </>
        )}
      </Section>

      {/* ② 加练自选 */}
      {plan.optional.length > 0 ? (
        <Section
          className="mt-4"
          as="div"
          tone="neutral"
          variant="outlined"
          icon={Rocket}
          title="加练自选"
          meta={`${plan.optional.length} 项`}
        >
          <p className="text-sm leading-relaxed text-muted">
            时间有富余、状态也不错时才考虑。
            <span className="font-semibold text-text">不做也完全没问题</span>
            —— 它们不在今天的计划里。
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
            {plan.optional.map((item, index) => (
              <li key={item.skill}>
                <PlanItemCard item={item} index={items.length + index + 1} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ③ 为什么今天练这些 */}
      <PlanReasonList className="mt-4" reasons={plan.reasons} />

      {/* ④ 训练提示 */}
      {plan.tips.length > 0 ? (
        <Section
          className="mt-4"
          as="div"
          tone="guide"
          variant="outlined"
          icon={Lightbulb}
          title="训练提示"
        >
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {plan.tips.map((tip, index) => (
              <li key={index} className="flex gap-2 text-sm leading-[1.7] text-text">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-pill bg-violet" />
                <span className="min-w-0">{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ⑤ 本周 */}
      <Section
        className="mt-4"
        as="div"
        tone="data"
        variant="outlined"
        icon={TrendingUp}
        title="本周"
      >
        <div className="flex items-center gap-4">
          <ProgressRing
            size="md"
            value={Math.min(daysPerWeek, weekDays)}
            total={daysPerWeek}
            label="本周训练进度"
            colorClass="text-info"
          />
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <div className="rounded-md bg-surface2 px-3 py-2">
              <dt className="text-xs text-muted">本周训练</dt>
              <dd className="tnum mt-0.5 font-mono text-base font-bold text-text">
                {weekDays}/{daysPerWeek}
                <span className="ml-0.5 text-xs font-semibold text-muted">天</span>
              </dd>
            </div>
            <div className="rounded-md bg-surface2 px-3 py-2">
              <dt className="text-xs text-muted">六艺总进度</dt>
              <dd className="tnum mt-0.5 font-mono text-base font-bold text-text">
                {totalDone}
                <span className="text-xs font-semibold text-muted">/{totalMoves}</span>
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      {/* ⑥ 我的设置 */}
      <Section
        className="mt-4"
        as="div"
        tone="neutral"
        variant="outlined"
        icon={Settings2}
        title="我的训练设置"
      >
        <dl className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-surface2 px-3 py-2.5">
            <dt className="text-xs text-muted">每周目标</dt>
            <dd className="tnum mt-0.5 font-mono text-base font-bold text-text">
              {daysPerWeek}
              <span className="ml-0.5 text-xs font-semibold text-muted">天</span>
            </dd>
          </div>
          <div className="rounded-md bg-surface2 px-3 py-2.5">
            <dt className="text-xs text-muted">默认时长</dt>
            <dd className="tnum mt-0.5 font-mono text-base font-bold text-text">
              {store.profile?.onboarding.sessionMinutes ?? 45}
              <span className="ml-0.5 text-xs font-semibold text-muted">分钟</span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
          所有数据只存在这台设备的浏览器里，不上传服务器；清除浏览器数据会一并清空。
        </p>
      </Section>

      {/* 抽屉 */}
      <AdjustSheet
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        plan={plan}
        patchPlan={patchPlan}
        resetPlanOptions={resetPlanOptions}
      />
      <LogSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        items={items}
        onSubmit={(result, advanceSkills) => {
          // 先写训练记录（拿到判定结果），再按用户确认推进式号。
          // 顺序不能反：judgeSession 要用推进前的 volumeTier/consecutiveEasy 来判定。
          const next = finishSession(result);
          for (const slug of advanceSkills) {
            const item = items.find((entry) => entry.skill === slug);
            if (item) completeStep(slug, item.stepNo);
          }
          setVerdicts(next);
        }}
      />
    </main>
  );
}

export default Plan;
