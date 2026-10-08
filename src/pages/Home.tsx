/**
 * Home —— 首页（v3 · 摘要页）。
 *
 * ## 这一版为什么长这样（v2 的问题与本次修法）
 *
 * v2 首页的两个病：
 * 1. **首屏有两个同样重的大卡互抢**（Hero 231px + 继续训练卡 206px，都用强调底 + 重阴影）
 *    → 用户「不知道看哪里」。v3 删掉 Hero（站名已在顶栏，介绍句对第 2 次访问是零信息），
 *    全页只留**一个**色调最重、且带唯一实心按钮的板块。
 * 2. **首页把「今天该练什么」回答了两遍，而且口径不同**：
 *    继续训练卡用的是「原书顺序第一个没练完的艺」，今日计划条用的是引擎算出来的主训。
 *    两者经常不是同一门艺 → 用户不知道该信哪个。
 *    v3 **只保留引擎的答案**，「我在哪一式」降到六艺列表里当纯数据。
 *
 * ## 首页的职责（一句话）
 * **只回答「今天要做什么」和「我练到哪了」，不承担任何操作。**
 * 所有操作（调整计划、逐组记录、疲劳反馈）都在训练页，首页只给一个入口。
 *
 * ## 结构
 * ```
 * ① 今天        tone=action  唯一重心 · 一个实心按钮 · 三个互斥状态
 * ② 本周概况    tone=data    三个数字（概况性内容）
 * ③ 六艺进度    tone=neutral 降噪列表：无箭头、无英文名、无重复数字
 * ④ 引导区      tone=guide   随状态变化：零记录→怎么开始；有记录→建议关注
 * ⑤ 安全与链接
 * ```
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Dumbbell,
  Grid3x3,
  ListOrdered,
  Play,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ArtSlug } from '@/types';
import { arts } from '@/data';
import { moveHref } from '@/lib/slug';
import { ART_ORDER, MOVES_PER_ART, SITE_NAME } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import { useDocumentMeta } from '@/lib/seo';
import { daysBetween, formatDateCn, weekStart } from '@/lib/plan/time';
import { useTraining } from '@/hooks/TrainingProvider';

import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { ProgressBar } from '@/components/ui/ProgressRing';

/** 「怎么开始」三步（零记录时展示） */
const START_STEPS: readonly { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Compass, title: '选一门艺', body: '按原书顺序从第一门开始，一次专注一门、不贪多。' },
  { icon: ListOrdered, title: '跟着计划练', body: '系统按你的恢复与疲劳算好今天练什么，照做即可。' },
  { icon: TrendingUp, title: '达标再进阶', body: '勾满进阶条件 → 完成本式 → 自动进入下一式，进度自动保存。' },
];

/** 概况里的单个数字 */
function Stat({
  label,
  value,
  unit,
  toneClass,
}: {
  label: string;
  value: string;
  unit?: string;
  toneClass: string;
}) {
  return (
    <div className="min-w-0 rounded-md bg-surface/60 px-3 py-2.5">
      <p className="truncate text-xs font-semibold text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-0.5">
        <span className={['tnum font-mono text-xl font-extrabold leading-none', toneClass].join(' ')}>
          {value}
        </span>
        {unit ? <span className="text-xs font-semibold text-muted">{unit}</span> : null}
      </p>
    </div>
  );
}

export function Home() {
  useDocumentMeta(
    `首页 · ${SITE_NAME}`,
    '《囚徒健身》六艺十式（共 60 式）动作指导：查看今天该练什么、你的六艺进度与本周训练概况，进入训练页打卡记录。',
  );

  const { store, plan, ready, today, trainedToday } = useTraining();
  const skills = store.skills;

  /* ---- ① 今天 ---- */
  const mainItem = plan?.main ?? null;
  const assists = plan?.assists ?? [];

  /* ---- ② 本周概况 ---- */
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
  const totalDone = ART_ORDER.reduce(
    (sum, slug) => sum + Math.min(MOVES_PER_ART, skills[slug].completedSteps.length),
    0,
  );
  const totalMoves = ART_ORDER.length * MOVES_PER_ART;
  const sessionCount = store.sessions.filter((session) => session.state === 'done').length;

  /* ---- ③ 六艺进度 ---- */
  const artRows = arts.map((art) => {
    const skill = skills[art.slug];
    const done = Math.min(MOVES_PER_ART, skill.completedSteps.length);
    const stepNo = Math.min(MOVES_PER_ART, skill.currentStep);
    return {
      ...art,
      done,
      finished: done >= MOVES_PER_ART,
      /** 用户长期关闭了这一门（没环境练 / 暂时不练）—— 进度照常显示，只是不再排进计划 */
      excluded: skill.excluded,
      stepName: art.moves.find((move) => move.stepNo === stepNo)?.nameZh ?? '',
      stepNo,
    };
  });

  /* ---- ④ 引导区：有记录时挑「最久没练且还没练完」的那门 ---- */
  const stalest = (() => {
    if (!ready || sessionCount === 0) return null;
    // 长期关闭的艺不参与推荐 —— 建议用户去练一门他明确说了「没环境练」的科目，
    // 是这类推荐最容易犯的错。
    const pending = ART_ORDER.filter(
      (slug) => skills[slug].completedSteps.length < MOVES_PER_ART && !skills[slug].excluded,
    );
    if (pending.length === 0) return null;
    const scored = pending.map((slug) => {
      const last = skills[slug].lastTrainedAt;
      return { slug, days: last === null ? Number.POSITIVE_INFINITY : daysBetween(last, today) };
    });
    scored.sort((a, b) => b.days - a.days);
    return scored[0];
  })();

  const stalestArt = stalest ? arts.find((art) => art.slug === stalest.slug) : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-nav pt-5">
      {/* 页头 —— 页面唯一的 h1。v2 的 Hero 承担了这个角色，
          v3 删掉 Hero 后不能顺手把 h1 也删了（读屏会失去页面标题）。 */}
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text">
          今天
        </h1>
        <p className="tnum mt-1 text-xs text-muted">{formatDateCn(today)}</p>
      </header>

      {/* ① 今天 —— 全页唯一重心 */}
      <Section
        as="div"
        tone="action"
        variant="tinted"
        icon={Dumbbell}
        title="训练安排"
        meta={
          ready && plan && !trainedToday
            ? `约 ${Math.round((plan.warmupMinutes + plan.totalEstimatedMinutes + plan.cooldownMinutes) * 10) / 10} 分钟`
            : undefined
        }
      >
        {!ready || !plan ? (
          <div>
            <p className="text-base font-semibold leading-[1.6] text-text">
              先花 20 秒设好训练节奏，之后每天打开就能直接看到今天该练什么。
            </p>
            <Button className="mt-3.5 w-full" size="lg" to="/plan">
              开始设置
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        ) : trainedToday ? (
          <div>
            <p className="flex items-center gap-2 text-base font-bold text-success">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
              今天已经练完了
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {sessionCount > 0
                ? `累计记录 ${sessionCount} 次训练。恢复也是训练的一部分，明天见。`
                : '记录已保存。'}
            </p>
            <Button className="mt-3.5 w-full" variant="secondary" to="/plan">
              查看今天的记录
            </Button>
          </div>
        ) : (
          <div>
            <p className="tnum text-xs font-semibold text-muted">
              共 {1 + assists.length} 个动作
            </p>

            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[26px] font-extrabold leading-tight tracking-tight text-text">
                {mainItem?.nameZh ?? '恢复日'}
              </span>
              {mainItem ? (
                <span className="text-sm font-semibold text-muted">
                  {arts.find((art) => art.slug === mainItem.skill)?.nameZh} 第{' '}
                  {mainItem.stepNo} 式
                </span>
              ) : null}
            </p>

            {assists.length > 0 ? (
              <p className="mt-1 truncate text-sm text-muted">
                辅助：{assists.map((item) => item.nameZh).join(' · ')}
              </p>
            ) : null}

            <Button className="mt-4 w-full" size="lg" to="/plan">
              <Play aria-hidden="true" className="h-4 w-4" />
              开始训练
            </Button>

            {/*
              首页的原则是「只回答今天做什么、不承担操作」，因此这里**不新增按钮、不新增色块** ——
              只把原有那一行文案的位置换成入口链接，主按钮仍是本页唯一的实心按钮。
            */}
            <div className="mt-3 flex flex-col items-center gap-0.5">
              <Link
                to="/plan/today"
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent underline-offset-2 hover:underline"
              >
                先看今天的 {1 + assists.length} 个动作
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
              <p className="text-center text-xs leading-relaxed text-muted">
                时间、换方案、逐组记录都在训练页
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* ② 本周概况 */}
      {ready ? (
        <Section
          className="mt-4"
          as="div"
          tone="data"
          variant="outlined"
          icon={TrendingUp}
          title="本周概况"
          meta={`${weekDays}/${store.profile?.onboarding.daysPerWeek ?? 0} 天`}
        >
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="本周训练"
              value={String(weekDays)}
              unit={`/${store.profile?.onboarding.daysPerWeek ?? 0} 天`}
              toneClass="text-info"
            />
            <Stat
              label="六艺总进度"
              value={String(totalDone)}
              unit={`/${totalMoves}`}
              toneClass="text-text"
            />
            <Stat label="累计记录" value={String(sessionCount)} unit="次" toneClass="text-text" />
          </div>
        </Section>
      ) : null}

      {/* ③ 六艺进度 —— 降噪列表 */}
      <Section
        className="mt-4"
        as="div"
        tone="neutral"
        variant="plain"
        icon={Grid3x3}
        title="六艺进度"
        meta={`${totalDone}/${totalMoves}`}
        padding="none"
        action={
          <Link
            to="/arts"
            className="shrink-0 text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            全部
          </Link>
        }
      >
        <ul className="divide-y divide-border">
          {artRows.map((art) => {
            const theme = artTheme(art.slug as ArtSlug);
            return (
              <li key={art.slug}>
                <Link
                  to={`/arts/${art.slug}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface2"
                >
                  <span
                    className={[
                      'tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold',
                      theme.solid,
                    ].join(' ')}
                  >
                    {art.order}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-bold text-text">{art.nameZh}</span>
                      {/* 长期关闭态：用中性 chip 而不是红字 —— 这是用户自己的设置，不是异常 */}
                      {art.excluded ? (
                        <span className="shrink-0 rounded-pill bg-surface2 px-1.5 py-px text-[10px] font-semibold text-muted">
                          已关闭
                        </span>
                      ) : null}
                      <span className="tnum ml-auto shrink-0 font-mono text-xs font-semibold text-muted">
                        {art.done}
                        <span className="text-subtle">/{MOVES_PER_ART}</span>
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {art.finished ? '十式全部完成' : `第 ${art.stepNo} 式 ${art.stepName}`}
                    </span>
                    <ProgressBar
                      className="mt-1.5"
                      value={art.done}
                      total={MOVES_PER_ART}
                      label={`${art.nameZh}进度`}
                      barClass={theme.bar}
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ④ 引导区 —— 随状态变化 */}
      {ready && stalest && stalestArt ? (
        <Section
          className="mt-4"
          as="div"
          tone="guide"
          variant="outlined"
          icon={Sparkles}
          title="建议关注"
        >
          <p className="text-base leading-[1.7] text-text">
            <span className="font-bold">{stalestArt.nameZh}</span>
            {Number.isFinite(stalest.days) ? (
              <> 已经 {stalest.days} 天没有训练了</>
            ) : (
              <> 还没开始训练</>
            )}
            。如果今天状态一般，也可以先把它安排进去。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="md"
              variant="secondary"
              to={moveHref(stalest.slug, skills[stalest.slug].currentStep)}
            >
              看这一式
            </Button>
            <Button size="md" variant="ghost" to={`/arts/${stalest.slug}`}>
              整门十式
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </Section>
      ) : (
        <Section
          className="mt-4"
          as="div"
          tone="guide"
          variant="outlined"
          icon={Compass}
          title="怎么开始"
        >
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {START_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-soft text-violet">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="tnum text-xs font-bold text-violet">
                      第 {index + 1} 步
                    </span>
                    <span className="block text-sm font-bold leading-snug text-text">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-[1.7] text-muted">
                      {step.body}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {/* ⑤ 安全与链接 */}
      <div className="mt-4">
        <SafetyNotice text="训练前请充分热身，循序渐进、量力而行；动作过程中出现疼痛请立即停止，有伤病者请先咨询专业人士。" />
      </div>

      <nav aria-label="更多内容" className="mt-3 grid grid-cols-2 gap-3">
        <Link
          to="/principles"
          className="flex min-h-[52px] items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-card transition-colors hover:border-border-strong"
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-text">训练原则</span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              渐进 · 不力竭 · 组间休息
            </span>
          </span>
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle" />
        </Link>
        <Link
          to="/about"
          className="flex min-h-[52px] items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-card transition-colors hover:border-border-strong"
        >
          <span className="min-w-0">
            <span className="block text-sm font-bold text-text">关于与免责</span>
            <span className="mt-0.5 block truncate text-xs text-muted">内容来源与版权</span>
          </span>
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle" />
        </Link>
      </nav>
    </main>
  );
}

export default Home;
