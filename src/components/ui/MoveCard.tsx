/**
 * MoveCard —— 招式卡片。
 *
 * 结构：`FigureSlot`(1/1 缩略图位，角标为「第 N 式」) + 中英文名 + 难度徽章；
 * **整卡可点击**，使用 `<Link>` 做站内跳转（不整页刷新）。
 *
 * 数据由 props 传入，本组件不含业务逻辑、不读取 `@/data`。
 */
import { Link } from 'react-router-dom';
import type { MoveDifficulty } from '@/types';
import { FigureSlot } from '@/components/ui/FigureSlot';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { buildMoveFigureLabel } from '@/lib/figureLabel';

/** `MoveCard` 的 props */
export interface MoveCardProps {
  /** 序号 1–10 */
  stepNo: number;
  /** 招式中文名 */
  nameZh: string;
  /** 招式英文名 */
  nameEn: string;
  /** 难度等级 */
  difficulty: MoveDifficulty;
  /** 详情页路径，如 `/arts/pushups/5` */
  href: string;
  /**
   * 动作描述：用于生成图位无障碍标签（须描述动作本身，非文件名 / 序号 —— PRD P0-18）。
   * 省略时图位标签回退为该式中文名（仍描述动作，不再出现「动作示意」等噪音）。
   */
  description?: string;
  className?: string;
}

/**
 * 招式卡片（整卡可点击）。
 *
 * @example
 * <MoveCard stepNo={5} nameZh="标准俯卧撑" nameEn="Full Push-ups" difficulty="中级" description="俯卧撑体系的基准动作。" href="/arts/pushups/5" />
 */
export function MoveCard({
  stepNo,
  nameZh,
  nameEn,
  difficulty,
  href,
  description = '',
  className = '',
}: MoveCardProps) {
  // 图位无障碍标签：走真源函数 `buildMoveFigureLabel` 统一生成，描述动作本身（PRD P0-18）。
  // 未提供描述时退化为招式名，绝不出现「动作示意」等无信息噪音。
  const figureLabel = description.trim()
    ? buildMoveFigureLabel({ nameZh, description })
    : nameZh;

  return (
    <Link
      to={href}
      className={[
        'flex items-center gap-3 rounded-md border border-border bg-surface p-3',
        'transition-colors hover:border-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 1/1 缩略图位：角标承载序号 */}
      <div className="w-20 shrink-0">
        <FigureSlot
          ratio="1/1"
          label={figureLabel}
          badge={`第 ${stepNo} 式`}
          note="待补充"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="truncate text-base font-semibold leading-snug text-text">
          {nameZh}
        </h3>
        <p className="truncate font-mono text-xs text-muted">{nameEn}</p>
        <div>
          <DifficultyBadge difficulty={difficulty} />
        </div>
      </div>
    </Link>
  );
}
