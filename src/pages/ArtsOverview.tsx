/**
 * ArtsOverview —— 六艺总览页（v2）。
 *
 * 与 v1 的差别：卡片从「3:4 空封面图位 + 三行字」换成紧凑进度卡，
 * 并把「推荐练习顺序」从纯文字列表改成带状态的时间线（哪门练完了、哪门在练、哪门没碰）。
 */
import { Link } from 'react-router-dom';
import { Check, Circle, Dot, Grid3x3, Route } from 'lucide-react';
import type { ArtSlug } from '@/types';
import { arts } from '@/data';
import { ART_ORDER, MOVES_PER_ART, SITE_NAME } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import type { ProgressState } from '@/lib/artTheme';
import { useDocumentMeta } from '@/lib/seo';
import { useTraining } from '@/hooks/TrainingProvider';
import { ArtCard } from '@/components/ui/ArtCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Section } from '@/components/ui/Section';

/** 状态 → 时间线标记（形状通道：✓ / ● / ○，不只靠颜色） */
function Marker({ state }: { state: ProgressState }) {
  if (state === 'done') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-success text-bg">
        <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-accent text-bg">
        <Dot aria-hidden="true" className="h-6 w-6" strokeWidth={7} />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-pill border-2 border-border-strong text-subtle">
      <Circle aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

export function ArtsOverview() {
  const artNames = arts.map((art) => art.nameZh).join('、');
  useDocumentMeta(
    `六艺总览 · ${SITE_NAME}`,
    `《囚徒健身》六艺一览：${artNames}六门基础动作，每门十式渐进，含推荐练习顺序与你的当前进度。`,
  );

  const { store } = useTraining();
  const skills = store.skills;

  /** 某艺的进度与状态 */
  const stateOf = (slug: ArtSlug) => {
    const skill = skills[slug];
    const done = Math.min(MOVES_PER_ART, skill.completedSteps.length);
    const status: ProgressState =
      done >= MOVES_PER_ART ? 'done' : skill.lastTrainedAt ? 'current' : 'idle';
    const stepNo = Math.min(MOVES_PER_ART, skill.currentStep);
    const art = arts.find((item) => item.slug === slug);
    return {
      done,
      status,
      stepNo,
      currentStepName:
        done < MOVES_PER_ART
          ? (art?.moves.find((move) => move.stepNo === stepNo)?.nameZh ?? null)
          : null,
    };
  };

  const totalDone = ART_ORDER.reduce(
    (sum, slug) => sum + Math.min(MOVES_PER_ART, skills[slug].completedSteps.length),
    0,
  );
  const totalMoves = ART_ORDER.length * MOVES_PER_ART;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-nav pt-6">
      <Breadcrumb items={[{ label: '首页', href: '/' }, { label: '六艺' }]} />

      <header className="mt-3">
        <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text sm:text-3xl">
          六艺总览
        </h1>
        <p className="mt-2.5 max-w-prose text-base leading-[1.75] text-text">
          六门基础动作门类，构成《囚徒健身》的核心体系。每门各含 10 个递进难度动作。
          点开任意一门，即可查看十式进阶路径、打卡进阶条件。
        </p>
        <p className="tnum mt-3 inline-flex items-center gap-2 rounded-pill bg-surface2 px-3 py-1.5 text-sm font-semibold text-muted">
          总体进度
          <span className="font-mono text-text">
            {totalDone}
            <span className="text-subtle">/{totalMoves}</span>
          </span>
        </p>
      </header>

      <Section
        className="mt-6"
        as="div"
        tone="neutral"
        variant="plain"
        icon={Grid3x3}
        title="六门艺"
        meta={`${totalDone}/${totalMoves}`}
        padding="none"
      >
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {arts.map((art) => {
            const info = stateOf(art.slug);
            return (
              <li key={art.slug}>
                <ArtCard
                  slug={art.slug}
                  order={art.order}
                  nameZh={art.nameZh}
                  nameEn={art.nameEn}
                  tagline={art.tagline}
                  href={`/arts/${art.slug}`}
                  progress={{ value: info.done, total: MOVES_PER_ART }}
                  statusLabel={
                    info.status === 'done'
                      ? '已完成'
                      : info.status === 'current'
                        ? '进行中'
                        : '未开始'
                  }
                  currentStepNo={info.stepNo}
                  currentStepName={info.currentStepName}
                />
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 推荐练习顺序（带状态的时间线） */}
      <Section
        className="mt-4"
        as="div"
        tone="guide"
        variant="outlined"
        icon={Route}
        title="推荐练习顺序"
      >
        <p className="max-w-prose text-base leading-[1.75] text-muted">
          《囚徒健身》建议按原书顺序逐艺推进：先把一门艺从第 1 式练到第 10 式、
          达到其「进阶标准」后，再进入下一门。不追求同时推进多门，稳扎稳打更重要。
        </p>

        <ol className="m-0 mt-3.5 flex list-none flex-col gap-3 p-0">
          {arts.map((art, index) => {
            const info = stateOf(art.slug);
            const theme = artTheme(art.slug);
            const isLast = index === arts.length - 1;
            const badgeClass =
              info.status === 'done'
                ? 'bg-success-soft text-success'
                : info.status === 'current'
                  ? 'bg-accent-soft text-accent'
                  : 'bg-surface2 text-muted';
            const badgeText =
              info.status === 'done'
                ? '已完成'
                : info.status === 'current'
                  ? `第 ${info.stepNo} 式`
                  : '未开始';

            return (
              <li key={art.slug} className="flex gap-3.5">
                <span className="flex flex-col items-center">
                  <Marker state={info.status} />
                  {!isLast ? (
                    <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" />
                  ) : null}
                </span>

                <Link
                  to={`/arts/${art.slug}`}
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-base font-bold text-text">{art.nameZh}</span>
                    <span className="font-mono text-[11px] text-subtle">
                      {art.nameEn}
                    </span>
                    <span
                      className={[
                        'rounded-pill px-1.5 py-0.5 text-[11px] font-bold',
                        badgeClass,
                      ].join(' ')}
                    >
                      {badgeText}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">
                    {art.tagline}
                  </span>
                  <span
                    className={['mt-1.5 block text-xs font-semibold', theme.text].join(' ')}
                  >
                    {info.currentStepName ?? `${MOVES_PER_ART} 式全部完成`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Section>
    </main>
  );
}

export default ArtsOverview;
