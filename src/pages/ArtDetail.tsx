/**
 * ArtDetail —— 六艺详情页（v2）。
 *
 * v2 变化：
 * - 页头加入**该艺进度环**与「你练到第几式」；
 * - 十式列表从「十张等权重的空图位卡」升级为**进度时间线**
 *   （✓ 已完成 / ● 进行中 / ○ 未开始，三种状态权重明显不同）；
 * - 顶部提供「继续第 N 式」主 CTA，直接跳到该练的那一式。
 */
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Dumbbell, ListChecks, Route } from 'lucide-react';
import type { Art, ArtSlug } from '@/types';
import { getAdjacentArts, getArt, getMovesByArt } from '@/data';
import { moveHref } from '@/lib/slug';
import { ART_COUNT, MOVES_PER_ART, SITE_NAME } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import type { ProgressState } from '@/lib/artTheme';
import { useDocumentMeta } from '@/lib/seo';
import { useTraining } from '@/hooks/TrainingProvider';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { MoveCard } from '@/components/ui/MoveCard';
import { ProgressionPath } from '@/components/ui/ProgressionPath';
import { Section } from '@/components/ui/Section';
import { ProgressRing } from '@/components/ui/ProgressRing';

interface ArtAdjacentNavProps {
  prev?: Art;
  next?: Art;
}

const NAV_CELL_BASE = 'flex min-h-[56px] flex-col justify-center gap-1 rounded-md border p-3';
const NAV_LINK_CLASS = `${NAV_CELL_BASE} border-border bg-surface shadow-card transition-colors hover:border-border-strong`;
const NAV_EMPTY_CLASS = `${NAV_CELL_BASE} border-dashed border-border bg-surface2 text-muted`;

function ArtAdjacentNav({ prev, next }: ArtAdjacentNavProps) {
  return (
    <nav aria-label="上一艺 / 下一艺" className="grid grid-cols-2 gap-3">
      {prev ? (
        <Link to={`/arts/${prev.slug}`} className={NAV_LINK_CLASS}>
          <span className="flex items-center gap-1 text-xs text-muted">
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            上一艺
          </span>
          <span className="truncate text-sm font-semibold text-text">{prev.nameZh}</span>
        </Link>
      ) : (
        <div className={NAV_EMPTY_CLASS} aria-disabled="true">
          <span className="text-xs text-muted">上一艺</span>
          <span className="text-sm">已是第一艺</span>
        </div>
      )}

      {next ? (
        <Link
          to={`/arts/${next.slug}`}
          className={`${NAV_LINK_CLASS} items-end text-right`}
        >
          <span className="flex items-center gap-1 text-xs text-muted">
            下一艺
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <span className="w-full truncate text-sm font-semibold text-text">
            {next.nameZh}
          </span>
        </Link>
      ) : (
        <div className={`${NAV_EMPTY_CLASS} items-end text-right`} aria-disabled="true">
          <span className="text-xs text-muted">下一艺</span>
          <span className="text-sm">已是最后一艺</span>
        </div>
      )}
    </nav>
  );
}

function ArtNotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mx-auto max-w-xl rounded-lg border border-border bg-surface p-6 text-center shadow-card sm:p-8">
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="mt-2 text-2xl font-bold text-text">找不到这门艺</h1>
        <p className="mt-3 text-base leading-[1.7] text-text">
          你访问的六艺地址不存在，可能链接有误或该内容尚未开放。请从六艺总览重新进入。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button to="/arts">查看六艺总览</Button>
          <Button to="/" variant="secondary">
            返回首页
          </Button>
        </div>
      </div>
    </main>
  );
}

export function ArtDetail() {
  const { artSlug } = useParams<{ artSlug: string }>();
  const art = artSlug ? getArt(artSlug) : undefined;

  useDocumentMeta(
    art ? `${art.nameZh} · 六艺详情 · ${SITE_NAME}` : `页面未找到 · ${SITE_NAME}`,
    art
      ? `${art.nameZh}（${art.nameEn}）：${art.tagline}。查看该艺的十式进阶路径与 10 个动作的难度、渐进顺序与你的当前进度。`
      : '你访问的六艺地址不存在。',
  );

  const { store } = useTraining();

  if (!art) {
    return <ArtNotFound />;
  }

  const skills = store.skills;
  const slug = art.slug as ArtSlug;
  const skill = skills[slug];
  const theme = artTheme(slug);

  const moves = getMovesByArt(slug);
  const { prev, next } = getAdjacentArts(slug);
  const completed = skill.completedSteps;
  const doneCount = Math.min(MOVES_PER_ART, completed.length);
  const stepNo = Math.min(MOVES_PER_ART, skill.currentStep);
  const currentMove = moves.find((move) => move.stepNo === stepNo);
  const allDone = doneCount >= MOVES_PER_ART;

  const stateOf = (moveStepNo: number): ProgressState => {
    if (completed.includes(moveStepNo)) return 'done';
    if (moveStepNo === stepNo) return 'current';
    return 'idle';
  };

  const progressionSteps = moves.map((move) => ({
    stepNo: move.stepNo,
    nameZh: move.nameZh,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-nav pt-6">
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '六艺', href: '/arts' },
          { label: art.nameZh },
        ]}
      />

      {/* 页头 */}
      <header className="mt-3">
        <p className="tnum font-mono text-xs font-semibold text-subtle">
          第 {art.order} 艺 / 共 {ART_COUNT} 艺
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-text sm:text-3xl">
          {art.nameZh}
        </h1>
        <p lang="en" className="mt-0.5 font-mono text-xs text-subtle">
          {art.nameEn}
        </p>
        <p className="mt-2 text-sm font-semibold text-muted">
          {allDone
            ? `${MOVES_PER_ART} 式全部完成`
            : `当前：第 ${stepNo} 式 ${currentMove?.nameZh ?? ''}`}
        </p>
      </header>

      {/* 本门进度（行动语义 = 橙） */}
      <Section
        className="mt-4"
        as="div"
        tone="action"
        variant="tinted"
        icon={Dumbbell}
        title="本门进度"
        meta={`${doneCount}/${MOVES_PER_ART}`}
      >
        <div className="flex items-center gap-4">
          <ProgressRing
            size="lg"
            value={doneCount}
            total={MOVES_PER_ART}
            label={`${art.nameZh}进度`}
            colorClass={theme.text}
          />
          <p className="min-w-0 flex-1 text-sm leading-[1.7] text-text">
            {allDone
              ? '这门艺的十式已经全部完成，可以转去推进下一门。'
              : `按原书方法：先把这一式练到「进阶标准」，勾满进阶条件再进入下一式。`}
          </p>
        </div>

        {!allDone ? (
          <Button className="mt-4 w-full" size="lg" to={moveHref(slug, stepNo)}>
            {doneCount === 0 ? '从第 1 式开始' : `继续第 ${stepNo} 式`}
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        ) : null}
      </Section>

      {/* 艺介绍（知识语义 = 绿） */}
      <Section
        className="mt-4"
        as="div"
        tone="body"
        variant="outlined"
        icon={BookOpen}
        title="艺介绍"
      >
        <p className="max-w-prose text-base leading-[1.75] text-text">{art.intro}</p>

        <h3 className="mt-4 text-xs font-bold text-muted">主要发力肌群</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {art.muscles.map((muscle) => (
            <li
              key={muscle}
              className="rounded-pill border border-border bg-surface2 px-3 py-1 text-sm text-text"
            >
              {muscle}
            </li>
          ))}
        </ul>
      </Section>

      {/* 十式进阶路径（数据语义 = 蓝） */}
      <Section
        className="mt-4"
        as="div"
        tone="data"
        variant="outlined"
        icon={Route}
        title="十式进阶路径"
      >
        <ProgressionPath
          steps={progressionSteps}
          currentStepNo={allDone ? undefined : stepNo}
          ariaLabel="十式进阶阶梯"
        />
      </Section>

      {/* 十式列表（纯列表 = 中性） */}
      <Section
        className="mt-4"
        as="div"
        tone="neutral"
        variant="plain"
        icon={ListChecks}
        title="十式列表"
        meta={`${doneCount}/${MOVES_PER_ART}`}
        padding="none"
      >
        <ul className="m-0 flex list-none flex-col gap-2.5 p-4">
          {moves.map((move) => (
            <li key={move.stepNo}>
              <MoveCard
                stepNo={move.stepNo}
                nameZh={move.nameZh}
                nameEn={move.nameEn}
                difficulty={move.difficulty}
                description={move.description}
                href={moveHref(slug, move.stepNo)}
                state={stateOf(move.stepNo)}
                hueClass={theme.text}
                hueSolidClass={theme.bar}
              />
            </li>
          ))}
        </ul>
      </Section>

      {/* 上一艺 / 下一艺 */}
      <div className="mt-4">
        <ArtAdjacentNav prev={prev} next={next} />
      </div>
    </main>
  );
}

export default ArtDetail;
