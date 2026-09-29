/**
 * ArtDetail —— 六艺详情页（架构 §4.1 / PRD §3.2 · P0-3 · T09）。
 *
 * 信息架构：
 * - 面包屑（首页 / 六艺 / {艺名}）；
 * - 页头：第 N 艺 + H1 艺名（中文）+ 英文名（Caption）；
 * - **艺介绍**（`SectionCard`）：定位段落 + 主要发力肌群；
 * - **十式进阶路径**（`ProgressionPath`，1 → 10 可视化阶梯；本页为**总览语境**，走「总览模式」）；
 * - **十式列表**：10 张 `MoveCard`（缩略图位 1/1，整卡可点）；
 * - **上一艺 / 下一艺导航**（`getAdjacentArts`，边界处理）；
 *
 * 非法参数：`artSlug` 不存在时，渲染**与 404 一致的提示内容**（不白屏、不抛错）；
 * 保持 HTTP 200 语义，由 SPA 内部处理（架构 §4.1）。
 *
 * 约束：数据一律从 `@/data` 取、路径由 `@/lib/slug` 的 `moveHref` 派生，页面不硬编码任何
 * 艺名 / 式名 / 路径；站内跳转一律 `<Link>`；颜色只走语义 token；正文 ≥16px、行高 ≥1.7；
 * 可点元素触控目标 ≥44×44px。
 */
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Art } from '@/types';
import { getAdjacentArts, getArt, getMovesByArt } from '@/data';
import { moveHref } from '@/lib/slug';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { MoveCard } from '@/components/ui/MoveCard';
import { ProgressionPath } from '@/components/ui/ProgressionPath';
import { SectionCard } from '@/components/ui/SectionCard';
import { useDocumentMeta } from '@/lib/seo';
import { ART_COUNT, SITE_NAME } from '@/lib/constants';

/**
 * 「上一艺 / 下一艺」导航。
 *
 * 说明：通用的 `PrevNextNav`（`components/ui`）为**十式**场景定制，其可见文案与
 * `aria-label` 固定为「上一式 / 下一式」，复用到艺级导航会产生语义误导，故此处按
 * 相同的视觉规范就地实现艺级导航（正确文案「上一艺 / 下一艺」，正确处理 `undefined` 边界）。
 */
interface ArtAdjacentNavProps {
  /** 上一艺（第一艺为 `undefined`） */
  prev?: Art;
  /** 下一艺（最后一艺为 `undefined`） */
  next?: Art;
}

/** 艺级导航单元格基础样式（触控目标 ≥44px） */
const NAV_CELL_BASE = 'flex min-h-[44px] flex-col justify-center gap-1 rounded-md border p-3';
const NAV_LINK_CLASS = `${NAV_CELL_BASE} border-border bg-surface transition-colors hover:border-accent`;
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
          <span className="truncate text-sm font-medium text-text">{prev.nameZh}</span>
        </Link>
      ) : (
        <div className={NAV_EMPTY_CLASS} aria-disabled="true">
          <span className="text-xs text-muted">上一艺</span>
          <span className="text-sm">已是第一艺</span>
        </div>
      )}

      {next ? (
        <Link to={`/arts/${next.slug}`} className={`${NAV_LINK_CLASS} items-end text-right`}>
          <span className="flex items-center gap-1 text-xs text-muted">
            下一艺
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <span className="w-full truncate text-sm font-medium text-text">{next.nameZh}</span>
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

/**
 * 非法 `artSlug` 的兜底内容 —— 与站点 404 提示保持一致（提示 + 返回入口），
 * 保证「不白屏、不抛错」且保留 HTTP 200 语义。
 */
function ArtNotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mx-auto max-w-xl rounded-md border border-border bg-surface p-6 text-center sm:p-8">
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

  // 钩子必须在任何提前 return 之前、且每次渲染顺序一致地调用。
  useDocumentMeta(
    art ? `${art.nameZh} · 六艺详情 · ${SITE_NAME}` : `页面未找到 · ${SITE_NAME}`,
    art
      ? `${art.nameZh}（${art.nameEn}）：${art.tagline}。查看该艺的十式进阶路径与 10 个动作的难度、渐进顺序。`
      : '你访问的六艺地址不存在。',
  );

  if (!art) {
    return <ArtNotFound />;
  }

  const moves = getMovesByArt(art.slug);
  const { prev, next } = getAdjacentArts(art.slug);
  const progressionSteps = moves.map((move) => ({
    stepNo: move.stepNo,
    nameZh: move.nameZh,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '六艺', href: '/arts' },
          { label: art.nameZh },
        ]}
      />

      {/* 页头：第 N 艺 + 艺名 + 英文名 */}
      <header className="mt-4">
        <p className="font-mono text-xs text-muted">
          第 {art.order} 艺 / 共 {ART_COUNT} 艺
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight text-text sm:text-3xl">
          {art.nameZh}
        </h1>
        <p lang="en" className="mt-1 font-mono text-sm text-muted">
          {art.nameEn}
        </p>
      </header>

      {/* 艺介绍：定位段落 + 主要发力肌群 */}
      <SectionCard title="艺介绍" className="mt-6">
        <p className="max-w-prose text-base leading-[1.7] text-text">{art.intro}</p>

        <div className="mt-4">
          <h3 className="text-base font-semibold text-text">主要发力肌群</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {art.muscles.map((muscle) => (
              <li
                key={muscle}
                className="rounded border border-border bg-surface2 px-2.5 py-1 text-sm text-text"
              >
                {muscle}
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* 十式进阶路径（1 → 10 可视化阶梯）；艺详情为总览语境，走「总览模式」（不传 currentStepNo） */}
      <SectionCard title="十式进阶路径" className="mt-6">
        <ProgressionPath
          steps={progressionSteps}
          ariaLabel="十式进阶总览（第 1 至第 10 式）"
        />
      </SectionCard>

      {/* 十式列表（10 张 MoveCard，整卡可点） */}
      <section aria-labelledby="art-moves-heading" className="mt-6">
        <h2 id="art-moves-heading" className="text-lg font-semibold text-text">
          十式列表
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {moves.map((move) => (
            <li key={move.stepNo}>
              <MoveCard
                stepNo={move.stepNo}
                nameZh={move.nameZh}
                nameEn={move.nameEn}
                difficulty={move.difficulty}
                description={move.description}
                href={moveHref(art.slug, move.stepNo)}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* 上一艺 / 下一艺导航 */}
      <div className="mt-6">
        <ArtAdjacentNav prev={prev} next={next} />
      </div>
    </main>
  );
}

export default ArtDetail;
