/**
 * ArtCard —— 六艺卡片。
 *
 * 结构：`FigureSlot`(3/4 封面图位) + 艺名 + 英文名 + 定位语；**整卡可点击**，
 * 使用 `<Link>` 做站内跳转（不整页刷新）。
 *
 * 数据由 props 传入，本组件不含业务逻辑、不读取 `@/data`。
 */
import { Link } from 'react-router-dom';
import { FigureSlot } from '@/components/ui/FigureSlot';
import { buildArtFigureLabel } from '@/lib/figureLabel';

/** `ArtCard` 的 props */
export interface ArtCardProps {
  /** 艺名（中文） */
  nameZh: string;
  /** 艺名（英文，等宽字体展示） */
  nameEn: string;
  /** 一句话定位（卡片用） */
  tagline: string;
  /** 详情页路径，如 `/arts/pushups` */
  href: string;
  /** 可选序号（原书顺序 1–6），用于角标 */
  order?: number;
  className?: string;
}

/**
 * 六艺卡片（整卡可点击）。
 *
 * @example
 * <ArtCard nameZh="俯卧撑" nameEn="Push-ups" tagline="上肢推力的根基" href="/arts/pushups" order={1} />
 */
export function ArtCard({
  nameZh,
  nameEn,
  tagline,
  href,
  order,
  className = '',
}: ArtCardProps) {
  return (
    <Link
      to={href}
      className={[
        'group flex flex-col overflow-hidden rounded-md border border-border bg-surface',
        'transition-colors hover:border-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <FigureSlot
        ratio="3/4"
        label={buildArtFigureLabel({ nameZh, tagline })}
        badge={order ? `第 ${order} 艺` : undefined}
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-base font-semibold leading-snug text-text">{nameZh}</h3>
        <p className="font-mono text-xs text-muted">{nameEn}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{tagline}</p>
      </div>
    </Link>
  );
}
