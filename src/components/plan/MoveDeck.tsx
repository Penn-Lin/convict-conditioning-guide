/**
 * MoveDeck —— 今日动作速览的横向翻页轨道。
 *
 * ## 翻页为什么用原生 `overflow-x` + `scroll-snap`
 * 惯性、回弹、单指横滑的方向判定、iOS 的边缘行为，全部由浏览器实现 ——
 * 自研「touch 事件 + transform 位移」要重新做一遍这些，还必然在某些机型上抖。
 * 所以这里一个 touch 事件都不监听，只做三件事：**同步页码、按钮翻页、键盘翻页**。
 *
 * ## 三条必须守住的约束（都是这个项目踩过的坑）
 * 1. **不引入任何 `dvh` + `flex-1` 的高度链。** 轨道高度由内容决定，纵向滚动交给 `body`，
 *    不套嵌套滚动区 —— 2026-10-02 手机白屏事故的根因正是那条链（见 `MEMORY.md` §1.5）。
 * 2. 轨道左右留 `px-4`，卡片不贴屏边 —— 既让出了 iOS 左边缘的系统返回手势区，
 *    又让「还有下一页」在视觉上可被察觉（卡片边缘露出来一点）。
 * 3. `overflow-x` 容器**默认不可聚焦**，不加 `tabIndex` 键盘用户根本滚不动。
 *
 * ## 播报策略
 * 手势滚动**不逐帧播报**（读屏会变成噪音），而是滚动停下 500ms 后播报一次；
 * 按钮 / 键盘翻页则立即播报 —— 那一刻用户明确期待「翻到哪了」的确认。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { DeckItem } from '@/lib/plan/deck';
import { MoveDeckCard } from '@/components/plan/MoveDeckCard';

/** `MoveDeck` 的 props */
export interface MoveDeckProps {
  /** 今天的动作（顺序 = 训练顺序） */
  deck: DeckItem[];
}

/** 把 URL 上的 `?i=` 解析为 0 起的页下标（非法值一律回到第 1 页） */
function parseInitialIndex(raw: string | null, total: number): number {
  const parsed = Number(raw);
  const lastIndex = Math.max(total - 1, 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.trunc(parsed) - 1, 0), lastIndex);
}

/**
 * 今日动作翻页轨道。
 *
 * @example
 * <MoveDeck deck={buildDeck(plan)} />
 */
export function MoveDeck({ deck }: MoveDeckProps) {
  const total = deck.length;
  const trackRef = useRef<HTMLUListElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  /** 进入时的目标页（读一次即可，后续由滚动驱动） */
  const initialIndexRef = useRef(parseInitialIndex(searchParams.get('i'), total));

  const [index, setIndex] = useState(initialIndexRef.current);
  /** 渲染出来的下标的同步副本：`goTo` 需要读最新值，闭包里的 `index` 会过期 */
  const indexRef = useRef(index);
  indexRef.current = index;
  /** 播报用的页下标（与 `index` 分开，理由见文件头） */
  const [announced, setAnnounced] = useState(initialIndexRef.current);

  /** 程序滚动的目标页；非 null 表示「正在被按钮/键盘驱动」，此时不参与滚动同步 */
  const targetRef = useRef<number | null>(null);
  const targetTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  /** 把某一页滚到轨道中央（同时不影响页面纵向滚动） */
  const scrollToIndex = (next: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current;
    const child = track?.children[next] as HTMLElement | undefined;
    if (!track || !child) return;

    const trackRect = track.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    track.scrollBy({
      left:
        childRect.left + childRect.width / 2 - (trackRect.left + track.clientWidth / 2),
      behavior,
    });
  };

  /**
   * 把页面纵向滚回轨道顶部。
   *
   * 为什么需要：卡片比一屏高，用户滚到底看过「注意 / 降阶 / 页脚」之后再按下一页时，
   * 新一页会继承那个滚动位置 —— 眼里直接是页面中段，等于「翻过去却看不见头」。
   * 只在**按钮 / 键盘**翻页时收（手势翻页时手就贴在轨道上，强行回顶会跟手指打架）。
   */
  const scrollDeckIntoView = () => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  };

  /** 翻到某一页（绝对下标：立即更新页码并播报） */
  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), Math.max(total - 1, 0));
    setIndex(clamped);
    setAnnounced(clamped);
    targetRef.current = clamped;
    scrollToIndex(clamped);
    scrollDeckIntoView();

    if (targetTimerRef.current !== null) window.clearTimeout(targetTimerRef.current);
    targetTimerRef.current = window.setTimeout(() => {
      targetRef.current = null;
    }, 900);
  };

  /**
   * 相对翻页。
   *
   * 基准取「待到达的目标」而不是渲染出来的 `index`：`setState` 是异步的，
   * 连点两下「下一个动作」时第二下读到的还是旧下标 —— 结果只前进了一页。
   * 键盘连按 → 也一样，`keydown` 的重复触发会密集调用这里。
   */
  const step = (delta: number) => {
    goTo((targetRef.current ?? indexRef.current) + delta);
  };

  /* 首次进入：若 URL 指定了页，静默定位过去（不要动画，否则像「自己翻了一下」） */
  useLayoutEffect(() => {
    if (initialIndexRef.current > 0) scrollToIndex(initialIndexRef.current, 'auto');
    // 只在挂载时跑一次：之后位置一律由用户手势与 goTo 决定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 卸载时清掉所有计时器，避免对已卸载组件 setState */
  useEffect(
    () => () => {
      if (targetTimerRef.current !== null) window.clearTimeout(targetTimerRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  /** 滚动同步：找出离轨道中心最近的一页 */
  const syncIndex = () => {
    const track = trackRef.current;
    if (!track) return;

    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + track.clientWidth / 2;

    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((child, childIndex) => {
      const rect = (child as HTMLElement).getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = childIndex;
      }
    });

    if (targetRef.current !== null) {
      // 程序滚动途中不回写页码：否则数字会「跳过去又跳回来」
      if (best === targetRef.current) {
        targetRef.current = null;
        setIndex(best);
      }
    } else {
      setIndex(best);
    }

    // 滚动停下后播报（手势滚动不逐帧播报）
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => setAnnounced(best), 500);
  };

  const handleScroll = () => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      syncIndex();
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goTo(total - 1);
    }
  };

  /* 页码写回 URL：用 replace —— 不新增历史条目，
     否则按一次返回只退一页，用户要退 4 次才能回到训练页。 */
  useEffect(() => {
    const current = String(index + 1);
    if (searchParams.get('i') === current) return;
    const next = new URLSearchParams(searchParams);
    next.set('i', current);
    setSearchParams(next, { replace: true });
  }, [index, searchParams, setSearchParams]);

  const current = deck[index];
  const atStart = index === 0;
  const atEnd = index === total - 1;

  return (
    <div>
      {/* 读屏播报位：内容随翻页更新，视觉上不可见 */}
      <p aria-live="polite" className="sr-only">
        {current
          ? `第 ${announced + 1} 页，共 ${total} 页：${current.item.nameZh}`
          : ''}
      </p>

      <ul
        ref={trackRef}
        tabIndex={0}
        aria-label="今天的动作，左右滑动或按方向键翻页"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="m-0 flex list-none snap-x snap-mandatory items-start gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 pt-1"
      >
        {deck.map((page) => (
          <MoveDeckCard key={`${page.item.skill}-${page.item.stepNo}`} page={page} total={total} />
        ))}
      </ul>

      {total > 1 ? (
        <div className="mt-3 flex items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={atStart}
            aria-label="上一个动作"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-border-strong bg-surface text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
            <span aria-hidden="true" className="flex items-center gap-1.5">
              {deck.map((page, dotIndex) => (
                <span
                  key={page.item.skill}
                  className={[
                    'h-1.5 rounded-pill transition-all duration-200',
                    dotIndex === index ? 'w-4 bg-accent' : 'w-1.5 bg-border-strong',
                  ].join(' ')}
                />
              ))}
            </span>
            <span className="tnum shrink-0 font-mono text-xs font-semibold text-muted">
              {index + 1} / {total}
            </span>
          </div>

          <button
            type="button"
            onClick={() => step(1)}
            disabled={atEnd}
            aria-label="下一个动作"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-border-strong bg-surface text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
