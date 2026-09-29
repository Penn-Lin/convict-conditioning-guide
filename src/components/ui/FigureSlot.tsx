/**
 * FigureSlot —— 图位占位组件（v1.3 新增）。
 *
 * 方向变更：姿态 / 矢量示意图方案整体停用。页面中「应当有图」的位置改为**图位占位**：
 * 用固定的宽高比预留出正确尺寸的空位，**不绘制任何图形 / 人形**，只做极简的占位提示。
 *
 * 设计要点：
 * - **布局高度恒定**：容器用内联 `aspect-ratio` 固定尺寸，**有无真实图片时高度完全一致**
 *   （CLS = 0）。
 * - **零硬编码色值**：`bg-surface2` / `border-border` / `text-muted` 全部走语义 token，
 *   浅色与深色主题自动适配。
 * - **面向未来**：预留可选 `src` / `alt`；一旦补入真实图片，只需传 `src`，**页面结构无需改动**。
 * - 纯展示组件：数据由 props 传入，不含业务逻辑，不读取 `@/data`。
 */
import { ImageOff } from 'lucide-react';

/** 图位默认补充说明文案（导出供页面复用 / 单测） */
export const FIGURE_SLOT_DEFAULT_NOTE = '图片待补充';

/** 支持的固定宽高比：六艺封面 3/4、十式主图 3/2、列表缩略 1/1 */
export type FigureSlotRatio = '3/4' | '3/2' | '1/1';

/** 宽高比 → CSS `aspect-ratio` 值 */
const RATIO_CSS: Record<FigureSlotRatio, string> = {
  '3/4': '3 / 4',
  '3/2': '3 / 2',
  '1/1': '1 / 1',
};

/**
 * 宽高比 → 真实图片的**显式固有尺寸**（intrinsic size）。
 * 占位态无需该值；接入真实图片时作为 `<img>` 的 width/height 兜底，进一步消除布局抖动。
 */
const RATIO_INTRINSIC: Record<FigureSlotRatio, { width: number; height: number }> = {
  '3/4': { width: 600, height: 800 },
  '3/2': { width: 900, height: 600 },
  '1/1': { width: 600, height: 600 },
};

/** `FigureSlot` 的 props（契约见任务书 T06） */
export interface FigureSlotProps {
  /** 宽高比：六艺封面 3/4、十式主图 3/2、列表缩略 1/1 */
  ratio: FigureSlotRatio;
  /** 无障碍标签：描述该式动作本身，不是文件名 */
  label: string;
  /** 可选角标，如「第 5 式」 */
  badge?: string;
  /** 可选补充说明，默认「图片待补充」 */
  note?: string;
  className?: string;
  /** 真实图片地址（可选）。提供时渲染 `<img>`；不提供时渲染占位态。 */
  src?: string;
  /** 真实图片的替代文本（可选）。容器已承载 `aria-label`，此处缺省为空字符串。 */
  alt?: string;
}

/**
 * 图位组件。
 *
 * @example
 * <FigureSlot ratio="3/4" label="标准俯卧撑动作示意" badge="第 5 式" />
 */
export function FigureSlot({
  ratio,
  label,
  badge,
  note = FIGURE_SLOT_DEFAULT_NOTE,
  className = '',
  src,
  alt = '',
}: FigureSlotProps) {
  const intrinsic = RATIO_INTRINSIC[ratio];

  return (
    <div
      role="img"
      aria-label={label}
      className={[
        'relative flex w-full items-center justify-center overflow-hidden',
        'rounded border border-border bg-surface2 text-muted',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      // 固定宽高比 —— 有无图片时布局高度一致（CLS = 0）
      style={{ aspectRatio: RATIO_CSS[ratio] }}
    >
      {src ? (
        // 接入真实图片：容器已固定比例，图片铺满即可，页面结构无需改动
        <img
          src={src}
          alt={alt}
          width={intrinsic.width}
          height={intrinsic.height}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        // 占位态：极简、克制，不出现任何图形或人形
        <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1 p-2 text-center">
          <ImageOff aria-hidden="true" className="h-6 w-6 shrink-0 opacity-70" />
          {badge ? (
            <span className="w-full truncate text-xs font-medium leading-tight">
              {badge}
            </span>
          ) : null}
          <span className="w-full truncate text-xs leading-tight">{note}</span>
        </div>
      )}
    </div>
  );
}
