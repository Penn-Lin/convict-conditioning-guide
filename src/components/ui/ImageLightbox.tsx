/**
 * ImageLightbox —— 动作示意图大图查看（v3 新增）。
 *
 * ## 为什么值得做
 *
 * 十式详情页的动作图是**两格并排的半宽小图**（375px 屏上每张约 167px 宽），
 * 看关节角度、手肘朝向、膝盖落点这类细节偏小。点开看大图是教学图的基本诉求。
 *
 * ## 技术选型
 *
 * 与 `Sheet` 一致：**原生 `<dialog>` + `showModal()`**，而不是自研遮罩层。
 * 焦点陷阱、`Esc` 关闭、`::backdrop`、读屏的模态语义全部免费获得；
 * 关闭时浏览器自动把焦点还给触发它的那个按钮。
 *
 * ## 可访问性
 *
 * - 左右方向键切换（仅多图时启用），按钮同时提供可见的点击入口；
 * - `aria-label` 说明当前看的是哪一张（「起始姿势 · 第 1 张，共 2 张」）；
 * - 关闭按钮 `aria-label="关闭大图"`。
 */
import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/** 大图条目 */
export interface ImageLightboxItem {
  src: string;
  /** 读屏用的完整描述 */
  alt: string;
  /** 图下方的短标签 */
  caption?: string;
}

export interface ImageLightboxProps {
  items: readonly ImageLightboxItem[];
  /** 当前打开的下标；`null` 表示关闭 */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/**
 * 大图查看器。
 *
 * @example
 * <ImageLightbox
 *   items={figures}
 *   index={open}
 *   onClose={() => setOpen(null)}
 *   onIndexChange={setOpen}
 * />
 */
export function ImageLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /** 把最新的 onClose 存进 ref，避免因它的引用变化而反复重挂 close 监听 */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const open = index !== null;
  const total = items.length;
  const current = index !== null ? items[index] : undefined;

  // 开 / 关与原生 dialog 状态同步
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
      // 复用 sheet-open：目的只是锁住背景滚动
      document.body.classList.add('sheet-open');
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // 原生 close（含 Esc）→ 同步回 React 状态并解锁滚动
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleClose = () => {
      document.body.classList.remove('sheet-open');
      onCloseRef.current();
    };
    el.addEventListener('close', handleClose);

    return () => {
      el.removeEventListener('close', handleClose);
      document.body.classList.remove('sheet-open');
    };
  }, []);

  const step = (delta: number) => {
    if (index === null || total < 2) return;
    onIndexChange((index + delta + total) % total);
  };

  return (
    <dialog
      ref={ref}
      className="lightbox"
      aria-label={
        current
          ? `${current.caption ?? current.alt} · 第 ${(index ?? 0) + 1} 张，共 ${total} 张`
          : '动作示意图'
      }
      // 点遮罩关闭：只有点到 dialog 自身（图片与控件之外）才算遮罩
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') step(-1);
        if (event.key === 'ArrowRight') step(1);
      }}
    >
      {current ? (
        <div className="flex h-full w-full flex-col">
          {/* 顶部工具条 */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-3">
            <span className="tnum rounded-pill px-2.5 py-1 text-xs font-semibold text-white/80">
              {(index ?? 0) + 1} / {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭大图"
              className="flex h-11 w-11 items-center justify-center rounded-pill text-white transition-colors hover:bg-white/15"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          {/* 图片区 */}
          <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-3 py-3">
            {total > 1 ? (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="上一张"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-bg/85 text-text backdrop-blur-sm transition-colors hover:bg-surface2"
              >
                <ChevronLeft aria-hidden="true" className="h-6 w-6" />
              </button>
            ) : null}

            <img
              src={current.src}
              alt={current.alt}
              className="min-h-0 min-w-0 flex-1 rounded-lg object-contain"
              style={{ maxHeight: '100%' }}
            />

            {total > 1 ? (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="下一张"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-bg/85 text-text backdrop-blur-sm transition-colors hover:bg-surface2"
              >
                <ChevronRight aria-hidden="true" className="h-6 w-6" />
              </button>
            ) : null}
          </div>

          {/* 底部说明 */}
          {current.caption ? (
            <p className="shrink-0 px-4 pb-6 pt-1 text-center text-sm font-medium text-white/90">
              {current.caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
