/**
 * MoveFigurePair —— 十式动作对照图（起始姿势 / 结束姿势）。
 *
 * 取代十式详情页原有的 `FigureSlot variant="strip"` 占位条。两张示范照片并排，
 * 「不看图也能知道在讲什么」由 `alt` + `figcaption` 承担。
 *
 * 设计约束：
 * - **不改变版面节奏**：双图各占一半宽、3:2 比例，不引入新色块、不套卡片外壳。
 * - **零硬编码色值**：底色 / 描边 / 文字全部走语义 token，浅深主题自动适配。
 * - **失败可降级**：单张加载失败时退回同尺寸占位块 —— 不出现破图，也不引起布局抖动。
 * - **可点开看大图**：半宽小图看关节角度、手肘朝向这类细节偏小，点击交给
 *   `ImageLightbox`（原生 `<dialog>`，带左右切换）。
 */
import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { ImageLightbox } from '@/components/ui/ImageLightbox';

/** 单张动作图 */
export interface MoveFigure {
  /** 图片地址 */
  src: string;
  /** 读屏用的完整描述（如「膝盖俯卧撑起始姿势」） */
  alt: string;
  /** 图下方的短标签（如「起始姿势」） */
  caption: string;
}

export interface MoveFigurePairProps {
  figures: readonly MoveFigure[];
  /** 这一组图的无障碍标题（描述这组图在讲什么） */
  label?: string;
  className?: string;
}

/**
 * 双图对照。
 *
 * @example
 * <MoveFigurePair
 *   label="膝盖俯卧撑：起始姿势与结束姿势"
 *   figures={[
 *     { src: '/actions/pushups/03-1.jpg', alt: '膝盖俯卧撑起始姿势', caption: '起始姿势' },
 *     { src: '/actions/pushups/03-2.jpg', alt: '膝盖俯卧撑结束姿势', caption: '结束姿势' },
 *   ]}
 * />
 */
export function MoveFigurePair({
  figures,
  label,
  className = '',
}: MoveFigurePairProps) {
  const [broken, setBroken] = useState<Record<string, true>>({});
  /** 大图查看：`null` = 关闭 */
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  return (
    <>
      <ul
        aria-label={label}
        className={['m-0 grid list-none grid-cols-2 gap-2 p-0', className]
          .filter(Boolean)
          .join(' ')}
      >
        {figures.map((figure, index) => (
          <li key={figure.src} className="min-w-0">
            <figure className="m-0">
              <div className="overflow-hidden rounded-md border border-border bg-surface2">
                {broken[figure.src] ? (
                  // 降级态：与图片同比例、同尺寸，不撑动版面；
                  // 给一行小字说明，避免变成「无言的空块」让人以为是设计如此
                  <div className="flex aspect-[3/2] flex-col items-center justify-center gap-1 text-muted">
                    <ImageOff aria-hidden="true" className="h-5 w-5 opacity-70" />
                    <span className="text-xs">图片加载失败</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setZoomIndex(index)}
                    aria-label={`放大查看${figure.alt}`}
                    className="block w-full cursor-zoom-in"
                  >
                    <img
                      src={figure.src}
                      alt={figure.alt}
                      width={628}
                      height={405}
                      loading="lazy"
                      decoding="async"
                      onError={() =>
                        setBroken((prev) => ({ ...prev, [figure.src]: true }))
                      }
                      className="block h-auto w-full"
                    />
                  </button>
                )}
              </div>
              <figcaption className="mt-1.5 text-xs font-medium text-muted">
                {figure.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <ImageLightbox
        items={figures}
        index={zoomIndex}
        onClose={() => setZoomIndex(null)}
        onIndexChange={setZoomIndex}
      />
    </>
  );
}
