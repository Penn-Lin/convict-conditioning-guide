/**
 * Card —— v2 的三级卡片体系。
 *
 * v1 的问题：全站只有「`border` + `bg-surface`」一种卡片样式，六艺卡、招式卡、内容块、
 * 错误块长得一模一样，眼睛没有落点。
 *
 * v2 分成三级，各自承担不同的视觉角色：
 *
 * | 级别 | 用途 | 外观 |
 * |---|---|---|
 * | `ActionCard` | 推动用户行动的卡（继续训练 / 今日计划 / 吸底 CTA） | 暖色渐变底 + 更粗描边 + 更重阴影 |
 * | `Card` | 平卡（列表项 / 内容块 / 信息分组） | 纯白底 + 细描边 + 极轻阴影 |
 * | `SemanticNote` | 语义块（要领 / 错误 / 风险 / 补充） | 4% 淡底 + 左侧 3px 色条 |
 *
 * 所有卡片一律「零硬编码色值」，只引用语义 token，浅深主题自动适配。
 */
import type { ElementType, ReactNode } from 'react';

/** 卡片圆角与阴影的统一基底 */
const CARD_BASE = 'rounded-lg border bg-surface shadow-card';

/* ---------------------------------------------------------------------------
 * Card —— 平卡
 * ------------------------------------------------------------------------ */

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** 内边距档位：`none` 用于图片卡（自行控制内边距），`sm/md/lg` 依次加大 */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** 渲染为什么元素（默认 `div`；省略标题时可换成 `section`） */
  as?: ElementType;
  /** 可交互时传 `to` 会用 `Link` 包裹（见 `CardLink`） */
  id?: string;
  'aria-labelledby'?: string;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 sm:p-6',
};

/** 平卡：内容分组的基本单位 */
export function Card({
  children,
  className = '',
  padding = 'md',
  as: Tag = 'div',
  ...rest
}: CardProps) {
  return (
    <Tag
      className={[CARD_BASE, 'border-border', PADDING[padding], className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------------------------
 * ActionCard —— 行动卡
 * ------------------------------------------------------------------------ */

export interface ActionCardProps {
  children: ReactNode;
  className?: string;
  padding?: NonNullable<CardProps['padding']>;
  /** 强调强度：`primary` 用 accent 渐变（最高优先级行动） */
  tone?: 'primary' | 'neutral';
}

/**
 * 行动卡：用于「继续训练」这类需要推动用户动手的卡片。
 *
 * 暖色渐变是通过 `bg-gradient-to-br from-accent-soft to-surface` 实现的，
 * 不引入任何新色值 —— 渐变的两端都是已有语义 token。
 */
export function ActionCard({
  children,
  className = '',
  padding = 'lg',
  tone = 'primary',
}: ActionCardProps) {
  const toneClass =
    tone === 'primary'
      ? 'border-accent/25 bg-gradient-to-br from-accent-soft via-surface to-surface shadow-card-hover'
      : 'border-border-strong bg-surface shadow-card';

  return (
    <div
      className={[CARD_BASE, toneClass, PADDING[padding], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * SemanticNote —— 语义块
 * ------------------------------------------------------------------------ */

/** 语义颜色档 */
export type NoteTone = 'good' | 'risk' | 'info' | 'neutral';

/** 语义档 → 左侧色条 + 淡底（完整字面量，供 JIT 扫描） */
const NOTE_TONE: Record<NoteTone, { stripe: string; bg: string }> = {
  good: { stripe: 'bg-success', bg: 'bg-success-soft' },
  risk: { stripe: 'bg-danger', bg: 'bg-danger-soft' },
  info: { stripe: 'bg-info', bg: 'bg-info-soft' },
  neutral: { stripe: 'bg-border-strong', bg: 'bg-surface2' },
};

export interface SemanticNoteProps {
  children: ReactNode;
  tone?: NoteTone;
  className?: string;
  /** 标题（会渲染为加粗小标题） */
  title?: string;
  /** 标题前的图标（可选，形状通道 —— 不靠颜色单独区分语义） */
  icon?: ReactNode;
}

/**
 * 语义块。
 *
 * 语义**不只靠颜色**：`tone` 通常配合不同图标（对勾 / 警示三角 / 信息圆）一起使用，
 * 保证色盲用户也能区分。
 */
export function SemanticNote({
  children,
  tone = 'neutral',
  className = '',
  title,
  icon,
}: SemanticNoteProps) {
  const { stripe, bg } = NOTE_TONE[tone];

  return (
    <div
      className={[
        'overflow-hidden rounded-md border border-border',
        bg,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex gap-3 p-3.5">
        <span aria-hidden="true" className={['w-[3px] shrink-0 rounded-pill', stripe].join(' ')} />
        <div className="min-w-0 flex-1">
          {title ? (
            <p className="flex items-center gap-1.5 text-sm font-bold text-text">
              {icon}
              {title}
            </p>
          ) : null}
          <div className={title ? 'mt-1' : ''}>{children}</div>
        </div>
      </div>
    </div>
  );
}
