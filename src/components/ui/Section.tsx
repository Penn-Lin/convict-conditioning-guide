/**
 * Section —— 板块容器（v3）。
 *
 * 解决的问题：v2 里所有卡片长得一样，板块之间没有边界感，页面看起来是「一长条内容」。
 * v3 用一个统一的板块壳把「这是哪一类信息」在视觉上框出来：
 *
 * - **色调**（`tone`）决定色相 —— 见 `lib/tones.ts` 的配色原则；
 * - **外框变体**（`variant`）决定这块信息的「轻重」：
 *   - `tinted`：淡底 + 同色描边 —— 需要被看见的板块（首页「今天」、本周概况）；
 *   - `outlined`：白底 + 同色描边 —— 次级板块（设置、说明）；
 *   - `plain`：白底 + 中性描边 —— 纯列表容器，不抢色。
 *
 * 注意这里**不用色调表达优先级**：「轻重」由 variant（底色强度）承担，
 * 色调只回答「这是哪一类信息」。两者分开，才不会出现「满屏都是重点」。
 */
import type { ElementType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/lib/tones';
import { toneStyle } from '@/lib/tones';

/** 外框变体 */
export type SectionVariant = 'tinted' | 'outlined' | 'plain';

const VARIANT_BY_TONE: Record<
  SectionVariant,
  keyof ReturnType<typeof toneStyle>
> = {
  tinted: 'tinted',
  outlined: 'outlined',
  plain: 'outlined',
};

/** `Section` 的 props */
export interface SectionProps {
  /** 模块色调（决定色相，不决定轻重） */
  tone?: Tone;
  /** 外框变体（决定这块信息有多"重"） */
  variant?: SectionVariant;
  /** 标题栏图标 */
  icon?: LucideIcon;
  /** 板块标题（省略时不渲染标题栏） */
  title?: string;
  /** 标题右侧的次要文字（如「4 项」「约 15 分钟」） */
  meta?: ReactNode;
  /** 标题栏最右侧的操作位（通常是文字链或小按钮） */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  /** 内容区内边距档位，默认 `md` */
  padding?: 'none' | 'sm' | 'md';
  /** 渲染为什么元素 */
  as?: ElementType;
}

const PADDING: Record<NonNullable<SectionProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
};

/**
 * 板块容器。
 *
 * @example
 * <Section tone="action" variant="tinted" icon={Dumbbell} title="今天" meta="约 15 分钟">
 *   <TodayCard />
 * </Section>
 */
export function Section({
  tone = 'neutral',
  variant = 'outlined',
  icon: Icon,
  title,
  meta,
  action,
  children,
  className = '',
  id,
  padding = 'md',
  as: Tag = 'section',
}: SectionProps) {
  const style = toneStyle(tone);
  const frame = style[VARIANT_BY_TONE[variant]];
  // 只要标题栏里还有任何内容（图标 / meta / 操作位），就渲染标题栏 ——
  // 这样「无标题但有图标和 meta」的板块也能成立，不必为了排版塞一个空标题。
  const hasHeader = Boolean(title || Icon || meta || action);

  return (
    <Tag
      id={id}
      className={[
        'overflow-hidden rounded-lg border shadow-card',
        frame,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader ? (
        <header
          className={[
            'flex items-center gap-2.5 border-b px-4 py-3',
            variant === 'tinted' ? style.border : 'border-border',
          ].join(' ')}
        >
          {Icon ? (
            <span
              aria-hidden="true"
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                style.chip,
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}

          {title ? (
            <h2 className="min-w-0 flex-1 truncate text-base font-bold leading-snug text-text">
              {title}
            </h2>
          ) : (
            <span className="min-w-0 flex-1" />
          )}

          {meta ? (
            <span className="tnum shrink-0 font-mono text-xs font-semibold text-muted">
              {meta}
            </span>
          ) : null}
          {action}
        </header>
      ) : null}

      <div className={PADDING[padding]}>{children}</div>
    </Tag>
  );
}
