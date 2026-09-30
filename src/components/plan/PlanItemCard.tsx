/**
 * PlanItemCard —— 今日计划里的单个训练项。
 *
 * 展示顺序刻意是「练什么 → 练多少 → 为什么」：
 * 训练现场需要的是前两项，第三项是给「不服气」的时刻看的（可折叠）。
 */
import { Link } from 'react-router-dom';
import { ChevronRight, Circle, Layers, Rocket, Star, Target } from 'lucide-react';
import type { PlanItem, ScheduleMode } from '@/types/plan';
import { getArt } from '@/data';
import { moveHref } from '@/lib/slug';
import { artTheme } from '@/lib/artTheme';
import { tierLabel } from '@/lib/plan/config';
import { formatSeconds, formatVolume } from '@/lib/plan/volumeLadder';
import { RichText } from '@/components/ui/RichText';

/** 角色 → 徽章文案与图标（自动调度模式） */
const ROLE_META = {
  main: { label: '主训练', Icon: Star, className: 'bg-accent text-bg' },
  assist: { label: '辅助训练', Icon: Circle, className: 'bg-surface2 text-muted' },
  optional: { label: '加练自选', Icon: Rocket, className: 'bg-info-soft text-info' },
} as const;

/**
 * 原书模板模式下的角色徽章。
 *
 * 六门是**平级科目** —— 组数、组间休息、训练量档上限全部一致，
 * 唯一的差别是「先做哪一门」（体力最好时做最难的）。
 * 所以这里不写「主 / 辅」，只表达顺序：写「辅助训练」会暗示量级差异，而那个差异并不存在。
 */
const TEXTBOOK_ROLE_META = {
  main: { label: '先练这门', Icon: Star, className: 'bg-accent text-bg' },
  assist: { label: '随后', Icon: Circle, className: 'bg-surface2 text-muted' },
  optional: { label: '加练自选', Icon: Rocket, className: 'bg-info-soft text-info' },
} as const;

/** 进阶测试项：与角色无关，单独一套徽章（它是「今天为什么练这么多」的答案） */
const CHALLENGE_META = {
  label: '进阶测试',
  Icon: Target,
  className: 'bg-violet text-bg',
} as const;

/** `PlanItemCard` 的 props */
export interface PlanItemCardProps {
  item: PlanItem;
  /** 在计划中的序号（1 = 主训） */
  index: number;
  /** 当前排期模式 —— 决定角色徽章的措辞（模板模式下六门平级，不写「主 / 辅」） */
  mode?: ScheduleMode;
  className?: string;
}

/**
 * 计划项卡片。
 *
 * @example
 * <PlanItemCard item={plan.main} index={1} />
 */
export function PlanItemCard({
  item,
  index,
  mode = 'auto',
  className = '',
}: PlanItemCardProps) {
  const art = getArt(item.skill);
  const theme = artTheme(item.skill);
  const roleMeta = mode === 'auto' ? ROLE_META : TEXTBOOK_ROLE_META;
  const meta = item.challenge ? CHALLENGE_META : roleMeta[item.role];
  const { Icon } = meta;
  const isMain = item.role === 'main';

  return (
    <div
      className={[
        'rounded-lg border bg-surface p-3.5 shadow-card',
        isMain ? 'border-accent/35' : 'border-border',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-3">
        {/* 序号：等宽数字，主训用色相实心 */}
        <span
          className={[
            'tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold',
            isMain ? theme.solid : 'bg-surface2 text-muted',
          ].join(' ')}
        >
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={[
                'inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[11px] font-bold',
                meta.className,
              ].join(' ')}
            >
              <Icon aria-hidden="true" className="h-3 w-3" />
              {meta.label}
            </span>
            <span className="truncate text-sm font-semibold text-muted">
              {art?.nameZh ?? item.skill} · 第 {item.stepNo} 式
            </span>
          </div>

          <p className="mt-1 truncate text-lg font-extrabold leading-tight text-text">
            {item.nameZh}
          </p>

          {/* 训练量：这是本卡片的「一眼数字」，档位徽章紧贴它，回答「今天练第几档」 */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={[
                'inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[11px] font-bold',
                isMain ? 'bg-accent-soft text-accent' : 'bg-surface2 text-muted',
              ].join(' ')}
            >
              <Layers aria-hidden="true" className="h-3 w-3" />
              {tierLabel(item.volumeTier)}
            </span>
            <span className="tnum font-mono text-base font-bold text-accent">
              {formatVolume(item.metric, item.sets, item.targetPerSet)}
            </span>
          </p>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>
              组间休息参考{' '}
              <span className="tnum font-semibold text-text">
                {item.restSeconds} 秒
              </span>
            </span>
            <span>
              预计{' '}
              <span className="tnum font-semibold text-text">
                {item.estimatedMinutes} 分钟
              </span>
            </span>
            {item.metric === 'hold' ? (
              <span className="text-muted">
                保持型：单次 {formatSeconds(item.targetPerSet)}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {/* 为什么安排它 —— 引擎生成的真实理由 */}
      <RichText
        className="mt-3 block rounded-md bg-surface2 px-3 py-2.5 text-sm leading-[1.7] text-muted"
        text={item.reason}
      />

      <Link
        to={moveHref(item.skill, item.stepNo)}
        className="mt-2.5 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent underline-offset-2 hover:underline"
      >
        看动作要领
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>
  );
}
