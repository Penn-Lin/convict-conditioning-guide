/**
 * Home —— 首页（v2）。
 *
 * v2 信息架构（相对 v1 的核心变化：把「继续训练」放到第一屏）：
 * 1. **Hero（压缩）**：站名 + 一句话价值 + 两个入口；
 * 2. **继续训练大卡（新增）**：进度环 + 「你练到哪一式」+ 今日计划摘要 + 主 CTA，
 *    让用户 1 秒内知道「我该干什么」；
 * 3. **今日计划条**：计划页的一句话摘要（有档案时显示）；
 * 4. **六艺进度网格**：紧凑信息卡（含 x/10 进度条），一屏可见 4–5 门；
 * 5. 如何开始 / 训练安全 / 继续了解。
 *
 * v1 的 6 张 3:4 封面图位卡（手机上每张约 450px 高，里面是空的）已被移除。
 */
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  Compass,
  Dumbbell,
  ListOrdered,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ArtSlug } from '@/types';
import { arts } from '@/data';
import { moveHref } from '@/lib/slug';
import { ART_ORDER, MOVES_PER_ART, SITE_NAME } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import { useDocumentMeta } from '@/lib/seo';
import { useTraining } from '@/hooks/TrainingProvider';
import { ArtCard } from '@/components/ui/ArtCard';
import { Button } from '@/components/ui/Button';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { ActionCard, Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';

/** 「如何开始」单个步骤 */
interface StartStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

const START_STEPS: readonly StartStep[] = [
  {
    icon: Compass,
    title: '选一门艺',
    body: '按原书顺序从第一门开始。六门艺彼此独立，一次专注一门、不贪多。',
  },
  {
    icon: ListOrdered,
    title: '从第 1 式练起',
    body: '每式都给出分解步骤、要领要点与常见错误，照着做，做完勾掉进阶条件。',
  },
  {
    icon: TrendingUp,
    title: '达标后再进阶',
    body: '勾满进阶条件 → 点「完成本式」→ 自动进入下一式，进度会一直保存。',
  },
];

/** 当前主练艺：原书顺序里第一个没练完的 */
function pickFocusArt(skills: Record<ArtSlug, { completedSteps: number[]; currentStep: number }>): ArtSlug {
  const pending = ART_ORDER.find((slug) => skills[slug].completedSteps.length < MOVES_PER_ART);
  return pending ?? ART_ORDER[0];
}

export function Home() {
  useDocumentMeta(
    `首页 · ${SITE_NAME}`,
    '《囚徒健身》六艺十式（共 60 式）在线动作指导：六门基础动作、每门十式渐进，含分解步骤、要领要点、常见错误与进阶标准，可打卡记录进度并自动生成今日训练计划。',
  );

  const { store, plan, ready } = useTraining();
  const skills = store.skills;
  const focusSlug = pickFocusArt(skills);
  const focusArt = arts.find((art) => art.slug === focusSlug) ?? arts[0];
  const focusTheme = artTheme(focusSlug);
  const focusSkill = skills[focusSlug];
  const focusDone = focusSkill.completedSteps.length;
  const focusStepNo = Math.min(MOVES_PER_ART, focusSkill.currentStep);
  const focusStepName =
    focusArt.moves.find((move) => move.stepNo === focusStepNo)?.nameZh ?? '';

  /** 某艺的进度与状态标签 */
  const progressOf = (slug: ArtSlug) => {
    const skill = skills[slug];
    const value = Math.min(MOVES_PER_ART, skill.completedSteps.length);
    const statusLabel =
      value >= MOVES_PER_ART ? '已完成' : skill.lastTrainedAt ? '进行中' : '未开始';
    const stepNo = Math.min(MOVES_PER_ART, skill.currentStep);
    const art = arts.find((item) => item.slug === slug);
    const currentStepName =
      value < MOVES_PER_ART
        ? (art?.moves.find((move) => move.stepNo === stepNo)?.nameZh ?? null)
        : null;
    return {
      value,
      total: MOVES_PER_ART,
      statusLabel,
      currentStepNo: stepNo,
      currentStepName,
    };
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-nav pt-6">
      {/* ① Hero（压缩） */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-surface2 via-surface to-surface p-5 sm:p-7">
        <p className="font-mono text-[11px] font-semibold tracking-wide text-muted">
          六艺 · 十式 · {ART_ORDER.length * MOVES_PER_ART} 个动作
        </p>
        <h1 className="mt-2.5 text-[28px] font-extrabold leading-tight tracking-tight text-text sm:text-4xl">
          囚徒健身
          <span className="ml-1.5 text-lg font-bold text-muted sm:text-2xl">六艺十式</span>
        </h1>
        <p className="mt-3 max-w-prose text-base leading-[1.75] text-text">
          把你的训练进度、进阶条件与今日计划放在一起。做完一勾，进度自动保存；
          明天该练什么，系统按恢复与疲劳替你算好并说清理由。
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Button to="/plan" size="lg">
            <Dumbbell aria-hidden="true" className="h-4 w-4" />
            {ready ? '今天练什么' : '开始设置'}
          </Button>
          <Button to="/arts" variant="secondary" size="lg">
            六艺总览
          </Button>
        </div>
      </section>

      {/* ② 继续训练大卡 */}
      <ActionCard className="mt-5" padding="lg">
        <div className="flex items-center gap-4">
          <ProgressRing
            size="lg"
            value={focusDone}
            total={MOVES_PER_ART}
            label={`${focusArt.nameZh}进度`}
            colorClass={focusTheme.text}
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-accent">
              继续训练
            </p>
            <p className="mt-1 truncate text-lg font-extrabold leading-tight text-text">
              {focusArt.nameZh} · 第 {focusStepNo} 式
            </p>
            <p className="mt-0.5 truncate text-base text-muted">{focusStepName}</p>
            <p className="tnum mt-1.5 text-sm font-semibold text-muted">
              已完成 {focusDone} / {MOVES_PER_ART} 式
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button
            to={moveHref(focusSlug, focusStepNo)}
            className="flex-1"
            size="lg"
          >
            {focusDone === 0 ? '开始第 1 式' : `继续第 ${focusStepNo} 式`}
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button to={`/arts/${focusSlug}`} variant="secondary" size="lg">
            该艺十式
          </Button>
        </div>
      </ActionCard>

      {/* ③ 今日计划条 */}
      {ready && plan ? (
        <Link
          to="/plan"
          className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-card transition-colors hover:border-border-strong"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface2 text-accent">
            <Dumbbell aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-text">今日训练计划</span>
            <span className="mt-0.5 block truncate text-sm text-muted">
              {plan.kind === 'recovery' ? '今天建议恢复' : plan.summary}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle" />
        </Link>
      ) : null}

      {/* ④ 六艺进度网格 */}
      <section aria-labelledby="home-arts-heading" className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-arts-heading" className="text-xl font-bold text-text">
            六艺进度
          </h2>
          <Link
            to="/arts"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            查看全部
          </Link>
        </div>

        <ul className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {arts.map((art) => {
            const progress = progressOf(art.slug);
            return (
              <li key={art.slug}>
                <ArtCard
                  slug={art.slug}
                  order={art.order}
                  nameZh={art.nameZh}
                  nameEn={art.nameEn}
                  tagline={art.tagline}
                  href={`/arts/${art.slug}`}
                  progress={progress}
                  statusLabel={progress.statusLabel}
                  currentStepNo={progress.currentStepNo}
                  currentStepName={progress.currentStepName}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* ⑤ 如何开始 */}
      <section aria-labelledby="home-start-heading" className="mt-8">
        <h2 id="home-start-heading" className="text-xl font-bold text-text">
          如何开始
        </h2>
        <ol className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {START_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title}>
                <Card className="h-full" padding="md">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface2 text-accent">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="tnum font-mono text-xs font-bold text-subtle">
                      步骤 {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-bold text-text">{step.title}</h3>
                  <p className="mt-1 text-base leading-[1.7] text-muted">{step.body}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ⑥ 安全提示 */}
      <section aria-labelledby="home-safety-heading" className="mt-8">
        <h2 id="home-safety-heading" className="text-xl font-bold text-text">
          训练安全
        </h2>
        <div className="mt-3.5">
          <SafetyNotice text="训练前请充分热身，循序渐进、量力而行；动作过程中出现疼痛请立即停止，有伤病者请先咨询专业人士。" />
        </div>
      </section>

      {/* ⑦ 继续了解 */}
      <section aria-labelledby="home-more-heading" className="mt-8">
        <h2 id="home-more-heading" className="text-xl font-bold text-text">
          继续了解
        </h2>
        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/principles"
            className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
          >
            <span className="min-w-0">
              <span className="block text-base font-bold text-text">训练原则</span>
              <span className="mt-0.5 block text-sm text-muted">
                渐进、不练到力竭、组间休息等原书方法
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-subtle" />
          </Link>
          <Link
            to="/about"
            className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
          >
            <span className="min-w-0">
              <span className="block text-base font-bold text-text">关于与免责声明</span>
              <span className="mt-0.5 block text-sm text-muted">
                内容来源、版权与医疗免责说明
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-subtle" />
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;
