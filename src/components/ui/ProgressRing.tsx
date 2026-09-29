/**
 * ProgressRing —— 进度环（六艺进度 / 今日完成度）。
 *
 * 纯 SVG，无依赖。数字用 `tnum` 等宽，避免每次进度变化时宽度跳动。
 *
 * 可访问性：整个环是一个 `role="img"` 并附带完整 `aria-label`（如「俯卧撑已完成 3 式，共 10 式」），
 * 环内的数字对读屏隐藏 —— 否则会被读成「3 斜杠 10」这种噪音。
 */
import type { ReactNode } from 'react';

/** 尺寸档 → 直径与字号（完整字面量，供 JIT 扫描） */
const SIZE = {
  sm: { box: 'h-11 w-11', text: 'text-[11px]', stroke: 4 },
  md: { box: 'h-16 w-16', text: 'text-base', stroke: 5 },
  lg: { box: 'h-24 w-24', text: 'text-2xl', stroke: 6 },
} as const;

export type ProgressRingSize = keyof typeof SIZE;

/** `ProgressRing` 的 props */
export interface ProgressRingProps {
  /** 已完成数量 */
  value: number;
  /** 总量 */
  total: number;
  /** 无障碍名称（如「俯卧撑进度」） */
  label: string;
  size?: ProgressRingSize;
  /** 环颜色类（如 `text-art-pushups`），默认 accent */
  colorClass?: string;
  className?: string;
  /** 环内自定义内容（默认显示 `value/total`） */
  children?: ReactNode;
}

/**
 * 进度环。
 *
 * @example
 * <ProgressRing value={3} total={10} label="俯卧撑进度" colorClass="text-art-pushups" />
 */
export function ProgressRing({
  value,
  total,
  label,
  size = 'md',
  colorClass = 'text-accent',
  className = '',
  children,
}: ProgressRingProps) {
  const { box, text, stroke } = SIZE[size];
  const safeTotal = Math.max(1, total);
  const clamped = Math.max(0, Math.min(value, safeTotal));
  const ratio = clamped / safeTotal;

  // 半径与周长：viewBox 固定 36×36，描边居中在 r 上
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;

  return (
    <div
      role="img"
      aria-label={`${label}：已完成 ${clamped}，共 ${safeTotal}`}
      className={['relative inline-flex shrink-0 items-center justify-center', box, className]
        .filter(Boolean)
        .join(' ')}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true" className="h-full w-full -rotate-90">
        {/* 轨道 */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface2"
        />
        {/* 进度弧 */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={['stroke-current transition-[stroke-dasharray] duration-500 ease-smooth', colorClass].join(' ')}
        />
      </svg>

      <span
        aria-hidden="true"
        className={[
          'tnum absolute inset-0 flex items-center justify-center font-mono font-bold leading-none text-text',
          text,
        ].join(' ')}
      >
        {children ?? (
          <>
            {clamped}
            <span className="text-muted">/{safeTotal}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** 线性进度条（列表里比环更省空间） */
export function ProgressBar({
  value,
  total,
  label,
  barClass = 'bg-accent',
  className = '',
}: {
  value: number;
  total: number;
  label: string;
  barClass?: string;
  className?: string;
}) {
  const safeTotal = Math.max(1, total);
  const clamped = Math.max(0, Math.min(value, safeTotal));
  const percent = Math.round((clamped / safeTotal) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
      aria-label={`${label}：${clamped}/${safeTotal}`}
      className={['h-1.5 w-full overflow-hidden rounded-pill bg-surface2', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={['h-full rounded-pill transition-[width] duration-500 ease-smooth', barClass].join(' ')}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
