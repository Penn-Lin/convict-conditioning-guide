/**
 * MoveCard —— 招式卡片（v2 重做）。
 *
 * v1 的结构是「80px 见方的空图位 + 名字 + 难度徽章」，六艺详情页里十张排下来，
 * 用户看到的是十块灰色方块。
 *
 * v2 改为**进度时间线卡**：左侧是状态标记（✓ 已完成 / ● 进行中 / ○ 未开始），
 * 中间是式名与难度，右侧是当前式指示。整卡仍是 `<Link>`，触控目标 ≥56px。
 */
import { Link } from 'react-router-dom';
import { Check, Circle, Dot } from 'lucide-react';
import type { MoveDifficulty } from '@/types';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import type { ProgressState } from '@/lib/artTheme';

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
   * 动作描述：用于生成图位无障碍标签（须描述动作本身，非文件名 / 序号）。
   * 省略时回退为该式中文名。
   */
  description?: string;
  /** 进度状态（v2 新增）：决定左侧标记与整卡权重 */
  state?: ProgressState;
  /** 色相类（与所属艺一致，只用于序号与状态点） */
  hueClass?: string;
  /** 左侧状态点的色相（用于「进行中」的实心点） */
  hueSolidClass?: string;
  className?: string;
}

/** 状态 → 标记元素 + 整卡样式 */
function stateStyle(state: ProgressState) {
  switch (state) {
    case 'done':
      return {
        marker: <Check aria-hidden="true" className="h-4 w-4 text-success" strokeWidth={3} />,
        wrap: 'border-border bg-surface',
        title: 'text-muted',
        label: '已完成',
      };
    case 'current':
      return {
        marker: <Dot aria-hidden="true" className="h-6 w-6 text-accent" strokeWidth={6} />,
        wrap: 'border-accent/45 bg-accent-soft shadow-card',
        title: 'text-text',
        label: '进行中',
      };
    default:
      return {
        marker: <Circle aria-hidden="true" className="h-4 w-4 text-subtle" strokeWidth={2} />,
        wrap: 'border-border bg-surface',
        title: 'text-text',
        label: '未开始',
      };
  }
}

/**
 * 招式卡片（整卡可点击）。
 *
 * @example
 * <MoveCard stepNo={5} nameZh="标准俯卧撑" nameEn="Full Push-ups" difficulty="中级"
 *           description="俯卧撑体系的基准动作。" href="/arts/pushups/5" state="current" />
 */
export function MoveCard({
  stepNo,
  nameZh,
  nameEn,
  difficulty,
  href,
  description = '',
  state = 'idle',
  hueClass = 'text-muted',
  hueSolidClass = 'bg-accent',
  className = '',
}: MoveCardProps) {
  const { marker, wrap, title, label } = stateStyle(state);
  const isCurrent = state === 'current';

  return (
    <Link
      to={href}
      aria-label={`第 ${stepNo} 式 ${nameZh}（${label}）${description ? `：${description}` : ''}`}
      className={[
        'flex min-h-[56px] items-center gap-3.5 rounded-lg border p-3.5',
        'transition-[border-color,box-shadow,transform] duration-200 ease-smooth',
        'hover:border-border-strong hover:shadow-card-hover active:scale-[0.99]',
        wrap,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* 序号 + 状态点：序号是主通道，状态点用形状（✓ / ● / ○）而非仅颜色 */}
      <span className="flex w-7 shrink-0 flex-col items-center gap-1">
        <span
          className={[
            'tnum font-mono text-base font-bold leading-none',
            isCurrent ? 'text-accent' : state === 'done' ? 'text-muted' : 'text-text',
          ].join(' ')}
        >
          {stepNo}
        </span>
        <span aria-hidden="true">{marker}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={[
              'truncate text-base leading-snug',
              isCurrent ? 'font-bold' : 'font-semibold',
              title,
            ].join(' ')}
          >
            {nameZh}
          </span>
          <DifficultyBadge difficulty={difficulty} />
        </span>
        <span
          className={['mt-0.5 block truncate font-mono text-[11px] text-subtle', hueClass].join(' ')}
        >
          {nameEn}
        </span>
      </span>

      {isCurrent ? (
        <span
          aria-hidden="true"
          className={['h-8 w-1 shrink-0 rounded-pill', hueSolidClass].join(' ')}
        />
      ) : null}
    </Link>
  );
}
