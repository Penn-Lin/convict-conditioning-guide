/**
 * Sheet —— 底部抽屉 / 弹窗（v3）。
 *
 * 为什么要用它：首页和训练页的信息量最大，但其中相当一部分是
 * **「必须存在、但不必常驻」** —— 调整计划的时间档、今天不想练哪门、
 * 逐组记录、疲劳反馈…… 把它们摊在页面上会把主屏淹掉。
 * 收进抽屉后主屏只留「现在要做什么」，需要时再拉出来。
 *
 * 技术选型：**原生 `<dialog>` + `showModal()`**，而不是自己搭遮罩层。
 * 这样以下四件事全部免费获得，不需要手写一行：
 * - 焦点陷阱（Tab 不会跑到底层页面）
 * - `Esc` 关闭
 * - `::backdrop` 遮罩与模态语义（读屏会正确播报为对话框）
 * - 打开期间底层元素不可交互
 *
 * 形态：移动端从底部滑入（拇指可达，符合单手操作）；≥1024px 改为居中弹窗
 * （鼠标场景下贴底反而离视线远）。这些都在 `index.css` 里的 `dialog.sheet` 规则中。
 */
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Tone } from '@/lib/tones';
import { toneStyle } from '@/lib/tones';

/** `Sheet` 的 props */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** 抽屉标题 */
  title: string;
  /** 标题下方的一句说明（可选） */
  description?: string;
  /** 顶部标题条的色调（默认中性） */
  tone?: Tone;
  /** 正文 */
  children: ReactNode;
  /** 吸底操作区（可选，常驻在滚动区之外） */
  footer?: ReactNode;
}

/**
 * 底部抽屉。
 *
 * @example
 * <Sheet open={open} onClose={close} title="调整今天的计划" tone="action">
 *   ...
 * </Sheet>
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  tone = 'neutral',
  children,
  footer,
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  /** 把最新的 onClose 存进 ref：避免因它的引用变化而反复重挂 close 监听 */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  /** 最近一次打开的时刻，用于忽略「打开瞬间的惯性点击」（见下方遮罩点击） */
  const openedAtRef = useRef(0);

  const style = toneStyle(tone);

  // 开 / 关与原生 dialog 状态同步
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
      document.body.classList.add('sheet-open');
      openedAtRef.current = Date.now();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // 原生 close（含 Esc、表单 method=dialog）→ 同步回 React 状态并解锁滚动
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
      // 若元素在「模态打开中」被 React 直接从 DOM 摘掉，浏览器可能残留模态状态
      // （表现为整页点不动）。卸载前显式关一次 —— 此时监听已摘除，不会回调 onClose。
      if (el.open) el.close();
      document.body.classList.remove('sheet-open');
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={headingId}
      // 点击遮罩关闭：只有点到 dialog 自身（内容之外）才算遮罩。
      //
      // 但打开后的头 350ms 要忽略点击 —— 点「开始训练 / 调整」的那一下，
      // 手指抬起时弹窗已经弹出，这一下会落在遮罩上把弹窗当场关掉，
      // 用户看到的就是「弹窗一闪就没了」。触屏上尤其明显。
      onClick={(event) => {
        if (event.target !== ref.current) return;
        if (Date.now() - openedAtRef.current < 350) return;
        onClose();
      }}
    >
      <div className="flex max-h-[90dvh] flex-col lg:max-h-[84dvh]">
        {/* 抓手条：暗示「可下拉/可关闭」 */}
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span aria-hidden="true" className="h-1 w-10 rounded-pill bg-border-strong" />
        </div>

        <header className="flex items-start gap-3 px-5 pb-3 pt-3">
          <span aria-hidden="true" className={['mt-0.5 h-1.5 w-1.5 shrink-0 rounded-pill', style.bar].join(' ')} />
          <div className="min-w-0 flex-1">
            <h2
              id={headingId}
              className="text-lg font-extrabold leading-tight tracking-tight text-text"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-text"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer ? (
          <div className="pb-safe shrink-0 border-t border-border bg-surface px-5 pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
