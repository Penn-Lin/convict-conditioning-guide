/**
 * ArtCard —— 六艺卡片（v2 重做）。
 *
 * v1 的问题：3/4 封面图位在手机单列布局下高达约 450px，一屏放不下两张卡，
 * 而里面是空的 —— 用户看到的是「六块缺图提示」，不是「六门艺」。
 *
 * v2 改为**紧凑信息卡**：色相序号徽章 + 艺名 + 定位语 + 十式进度条 + 状态标签。
 * 一屏能看到 4–5 门艺，进度一眼可比。图位整体移除（详情页仍保留紧凑图位条）。
 */
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import type { ArtSlug } from '@/types';
import { artTheme } from '@/lib/artTheme';
import { ProgressBar } from '@/components/ui/ProgressRing';

/** `ArtCard` 的 props */
export interface ArtCardProps {
  /** 艺 slug（决定色相） */
  slug: ArtSlug;
  /** 艺名（中文） */
  nameZh: string;
  /** 艺名（英文，等宽字体展示） */
  nameEn: string;
  /** 一句话定位 */
  tagline: string;
  /** 详情页路径，如 `/arts/pushups` */
  href: string;
  /** 原书顺序 1–6 */
  order: number;
  /** 十式进度 */
  progress: { value: number; total: number };
  /** 状态标签（如「进行中」「已完成」） */
  statusLabel?: string;
  /** 当前所在式号（用于副标题「第 N 式 · 动作名」） */
  currentStepNo?: number;
  /** 当前所在式的名字（可选，让卡片直接告诉用户「你练到哪了」） */
  currentStepName?: string | null;
  className?: string;
}

/**
 * 六艺卡片（整卡可点击）。
 *
 * @example
 * <ArtCard slug="pushups" order={1} nameZh="俯卧撑" nameEn="Push-ups" tagline="…"
 *          href="/arts/pushups" progress={{ value: 3, total: 10 }} />
 */
export function ArtCard({
  slug,
  nameZh,
  nameEn,
  tagline,
  href,
  order,
  progress,
  statusLabel,
  currentStepNo,
  currentStepName,
  className = '',
}: ArtCardProps) {
  const theme = artTheme(slug);
  const done = progress.value >= progress.total;

  return (
    <Link
      to={href}
      className={[
        'group flex items-center gap-3.5 rounded-lg border border-border bg-surface p-3.5 shadow-card',
        'transition-[border-color,box-shadow,transform] duration-200 ease-smooth',
        'hover:border-border-strong hover:shadow-card-hover active:scale-[0.99]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 色相序号徽章：数字（形状通道）+ 色相（颜色通道） */}
      <span
        className={[
          'tnum flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-mono text-lg font-bold',
          theme.solid,
        ].join(' ')}
      >
        {order}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-bold leading-snug text-text">
            {nameZh}
          </span>
          {statusLabel ? (
            <span
              className={[
                'shrink-0 rounded-pill px-1.5 py-0.5 text-[11px] font-bold',
                done ? 'bg-success-soft text-success' : 'bg-surface2 text-muted',
              ].join(' ')}
            >
              {done ? (
                <span className="flex items-center gap-0.5">
                  <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                  {statusLabel}
                </span>
              ) : (
                statusLabel
              )}
            </span>
          ) : null}
        </span>

        <span className="mt-0.5 block truncate font-mono text-[11px] text-subtle">
          {nameEn}
        </span>

        <span className="mt-1 block truncate text-sm leading-relaxed text-muted">
          {!done && currentStepName
            ? `第 ${currentStepNo ?? progress.value + 1} 式 · ${currentStepName}`
            : tagline}
        </span>

        <ProgressBar
          className="mt-2"
          value={progress.value}
          total={progress.total}
          label={`${nameZh}进度`}
          barClass={theme.bar}
        />
      </span>

      <span className="tnum shrink-0 font-mono text-sm font-bold text-muted">
        {progress.value}
        <span className="text-subtle">/{progress.total}</span>
      </span>

      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
