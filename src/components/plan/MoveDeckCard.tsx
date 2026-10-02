/**
 * MoveDeckCard —— 今日动作速览的**一页**（纯展示，不含任何状态）。
 *
 * ## 与十式详情页的分工
 * - 详情页（`pages/MoveDetail.tsx`）回答「这一式的全部内容」：打卡、训练目标三档、
 *   进阶标准原文、主要发力肌群、页内锚点…… 完整，但重；
 * - 这一页只回答「**现在这一下怎么做**」，一屏内说完，放不下的折叠或指向详情页。
 *
 * ## 阅读顺序（刻意贴着「第一次做」的认知顺序）
 * 图 → 今天的量 → 怎么做 → 注意 → 降阶 → 风险。
 * 「今天的量」排在第二位而非最后：练的人要先知道「做几组几下」才敢动；
 * 「降阶」默认折叠，因为它只在「做不动」时才需要，但那正是第一次做最怕的事，
 * 所以它必须在，只是不占常驻版面。
 *
 * ## 无障碍
 * 每页是一个 `role="group"` + `aria-roledescription="幻灯片"`，`aria-label` 里带页码与动作名
 * —— 读屏用户横向浏览时能知道「现在是第几页、这一页是什么」。
 * 难度是「文字 + 颜色」双通道（`DifficultyBadge`）；标题层级 h2（动作名）→ h3（分区）。
 */
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ImageOff,
  LifeBuoy,
  TriangleAlert,
} from 'lucide-react';

import type { DeckItem } from '@/lib/plan/deck';
import { getArt } from '@/data';
import { artTheme } from '@/lib/artTheme';
import { formatVolume } from '@/lib/plan/volumeLadder';
import { buildMoveFigureLabel } from '@/lib/figureLabel';
import { moveFigureSrc } from '@/lib/moveFigure';

import { MoveFigurePair } from '@/components/ui/MoveFigurePair';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { RichText } from '@/components/ui/RichText';
import { RiskNote } from '@/components/ui/RiskNote';

/** `MoveDeckCard` 的 props */
export interface MoveDeckCardProps {
  page: DeckItem;
  /** 总页数（用于无障碍标签与页码） */
  total: number;
}

/**
 * 速览页的一页。
 *
 * @example
 * <MoveDeckCard page={deck[0]} total={deck.length} />
 */
export function MoveDeckCard({ page, total }: MoveDeckCardProps) {
  const { item, move } = page;
  const art = getArt(item.skill);
  const theme = artTheme(item.skill);
  const artName = art?.nameZh ?? item.skill;

  return (
    <li
      role="group"
      aria-roledescription="幻灯片"
      aria-label={`第 ${page.page} 页，共 ${total} 页：${artName}第 ${item.stepNo} 式 ${item.nameZh}`}
      className="w-full shrink-0 snap-center"
    >
      {/*
        卡片高度 = 内容自然高度（轨道是 `items-start`，不拉伸）。
        刻意**不做等高**：某一页展开「降阶」后内容会明显变长，若强行等高，
        其余每一页都会多出一大片死空白 —— 而横向卡片的意义就是「一页刚好装完这一式」。
        轨道容器本身仍由最高的一页决定高度，所以翻页时页码条不会上下跳。
      */}
      <article className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {/* ---- 身份行 ---- */}
        <header className="flex items-start gap-3 px-4 pb-3 pt-4">
          <span
            className={[
              'tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold',
              theme.solid,
            ].join(' ')}
          >
            {page.page}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-muted">
              {artName} · 第 {item.stepNo} 式
              {art ? ` / 共 ${art.moves.length} 式` : ''}
            </p>
            <h2 className="mt-0.5 text-xl font-extrabold leading-tight tracking-tight text-text">
              {item.nameZh}
            </h2>
            {item.challenge ? (
              <span className="mt-1.5 inline-flex items-center rounded-pill bg-violet px-1.5 py-0.5 text-[11px] font-bold text-bg">
                进阶测试 · 原书高级标准
              </span>
            ) : null}
          </div>

          {move ? <DifficultyBadge difficulty={move.difficulty} /> : null}
        </header>

        {/* ---- 动作对照图 ---- */}
        <div className="px-4">
          {move ? (
            <MoveFigurePair
              label={buildMoveFigureLabel(move)}
              figures={[
                {
                  src: moveFigureSrc(item.skill, item.stepNo, 1),
                  alt: `${item.nameZh}起始姿势`,
                  caption: '起始姿势',
                },
                {
                  src: moveFigureSrc(item.skill, item.stepNo, 2),
                  alt: `${item.nameZh}结束姿势`,
                  caption: '结束姿势',
                },
              ]}
            />
          ) : (
            <div className="flex min-h-[104px] flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-surface2 text-muted">
              <ImageOff aria-hidden="true" className="h-5 w-5 opacity-70" />
              <span className="text-xs">这一式的资料暂时取不到</span>
            </div>
          )}
        </div>

        {/* ---- 今天的量（本页唯一的实心数字） ---- */}
        <div className="mt-4 px-4">
          <div className="rounded-md bg-surface2 px-3.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-xs font-bold text-muted">今天的量</span>
              <span className="tnum font-mono text-lg font-extrabold text-accent">
                {formatVolume(item.metric, item.sets, item.targetPerSet)}
              </span>
            </div>
            <p className="tnum mt-1 text-xs text-muted">
              组间休息参考 {item.restSeconds} 秒 · 预计 {item.estimatedMinutes} 分钟
            </p>
          </div>
        </div>

        {/* ---- 怎么做 ---- */}
        {page.steps.length > 0 ? (
          <section className="mt-4 px-4">
            <h3 className="text-xs font-bold text-muted">怎么做</h3>
            <ol className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
              {page.steps.map((step, index) => (
                <li key={index} className="flex gap-2 text-sm leading-[1.7] text-text">
                  <span
                    aria-hidden="true"
                    className="tnum mt-0.5 shrink-0 font-mono text-xs font-bold text-muted"
                  >
                    {index + 1}
                  </span>
                  <RichText text={step} />
                </li>
              ))}
            </ol>
            {page.totalSteps > page.steps.length ? (
              <p className="mt-2 text-xs text-muted">
                共 {page.totalSteps} 步，其余在详情页
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ---- 注意什么 ---- */}
        {page.notes.length > 0 ? (
          <section className="mt-4 px-4">
            <h3 className="text-xs font-bold text-muted">注意什么</h3>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
              {page.notes.map((note, index) => (
                <li key={index} className="flex gap-2 text-sm leading-[1.7] text-text">
                  {note.kind === 'mistake' ? (
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-danger"
                    />
                  ) : (
                    <Check
                      aria-hidden="true"
                      strokeWidth={3}
                      className="mt-1 h-4 w-4 shrink-0 text-success"
                    />
                  )}
                  <span className="min-w-0">
                    {note.kind === 'mistake' ? (
                      <span className="font-bold text-danger">常见错误：</span>
                    ) : null}
                    <RichText text={note.text} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- 太难了怎么办（折叠：只在做不动时才需要，但第一次做最怕没有它） ---- */}
        {page.regression ? (
          <details className="group mt-4 border-t border-border px-4 py-3">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-violet [&::-webkit-details-marker]:hidden">
              <LifeBuoy aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">太难了怎么办（降阶方案）</span>
              <ChevronDown
                aria-hidden="true"
                className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <RichText
              className="mt-1 block pb-1 text-sm leading-[1.8] text-text"
              text={page.regression}
            />
          </details>
        ) : null}

        {/* ---- 风险提示（常驻，安全信息不做折叠） ---- */}
        {page.riskNote ? (
          <RiskNote className="mx-4 mt-4" text={page.riskNote} />
        ) : null}

        {/* ---- 出口 ---- */}
        <footer className="mt-4 border-t border-border px-4 py-2.5">
          <Link
            to={move ? page.href : `/arts/${item.skill}`}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            {move ? '看完整动作要领' : `去${artName}看这一式`}
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </footer>
      </article>
    </li>
  );
}
