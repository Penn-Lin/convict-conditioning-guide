/**
 * ConfirmDialog —— 二次确认弹窗（v5 新增）。
 *
 * ## 为什么要有它
 * 站内有一批**不可忽略的推进动作**：完成本式（会改 `currentStep`）、
 * 「跳过条件直接标记完成」、撤销退回、提交训练记录、重置当天全部调整。
 * 它们的共同点是「一次点击即生效、且效果跨页面可见」——
 * 手指在手机上误触一次，进度就跳级了。用户明确反馈过这个损失。
 *
 * 因此统一走一个确认弹窗：**先把「这一下会发生什么」讲清楚，再让用户按下确认。**
 * 文案里必须带上真实数值（第几式、目标式名、会清掉哪些调整），
 * 而不是一句空泛的「确定吗？」—— 后者只会让人无脑再点一次。
 *
 * ## 技术选型
 * 与 `Sheet` 一致：**原生 `<dialog>` + `showModal()`**。焦点陷阱、Esc 关闭、
 * `::backdrop`、读屏的模态语义全部免费获得，不需要手写一行。
 * 样式在 `index.css` 的 `dialog.confirm`（刻意不加 `@layer`，理由同 `dialog.sheet`）。
 *
 * ## 两个易漏点
 * - **遮罩点击的 350ms 守卫**：点「完成本式」的那一下，手指抬起时弹窗已经弹出，
 *   这一下会落在遮罩上把弹窗当场关掉 —— 表现是「弹窗一闪就过」。触屏尤其明显。
 * - **不做 `body.sheet-open` 增删**：本弹窗可能开在某个 `Sheet` 之上，
 *   若在这里移除那个类，会把底下还在打开的抽屉的滚动锁一并解掉。
 */
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Tone } from '@/lib/tones';
import { toneStyle } from '@/lib/tones';

/** 一次确认请求的全部内容 */
export interface ConfirmRequest {
  /** 标题：一句话说清「你要做什么」，例如「完成第 3 式「折刀俯卧撑」？」 */
  title: string;
  /** 说明：这一下会造成什么后果 */
  description?: ReactNode;
  /** 逐条列出的具体影响（可选，用列表呈现，比一整段更好读） */
  details?: string[];
  /** 确认按钮文案 */
  confirmLabel?: string;
  /** 取消按钮文案 */
  cancelLabel?: string;
  /** 色调（默认 guide 紫）；`danger` 为真时强制走 risk 红 */
  tone?: Tone;
  /** 破坏性操作：确认按钮用红色，标题带警示图标 */
  danger?: boolean;
}

/** `ConfirmDialog` 的 props */
export interface ConfirmDialogProps {
  open: boolean;
  /** 当前请求；从未弹过时为 `null` */
  request: ConfirmRequest | null;
  /** 用户决定：`true` = 确认，`false` = 取消 / Esc / 点遮罩 */
  onResolve: (confirmed: boolean) => void;
}

/**
 * 确认弹窗（受控）。
 *
 * 通常不直接使用它，而是用 `useConfirm()` 拿一个 `confirm(request) => Promise<boolean>`。
 *
 * @example
 * <ConfirmDialog open={open} request={request} onResolve={settle} />
 */
export function ConfirmDialog({ open, request, onResolve }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const openedAtRef = useRef(0);
  /** 最新的 `onResolve`：避免因它换引用而反复重挂 close 监听 */
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      el.showModal();
      openedAtRef.current = Date.now();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // 原生 close（Esc / 程序化关闭）→ 回填「取消」。
  // 点确认按钮时是「先 resolve 再 close」，此时 resolver 已被消费，这次回调是空操作。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleClose = () => onResolveRef.current(false);
    el.addEventListener('close', handleClose);

    return () => {
      el.removeEventListener('close', handleClose);
      // 模态打开中被 React 直接摘出 DOM 会残留模态态（整页点不动），卸载前显式关一次
      if (el.open) el.close();
    };
  }, []);

  const danger = request?.danger ?? false;
  const style = toneStyle(danger ? 'risk' : (request?.tone ?? 'guide'));

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby={headingId}
      onClick={(event) => {
        if (event.target !== ref.current) return;
        if (Date.now() - openedAtRef.current < 350) return;
        onResolve(false);
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          {danger ? (
            <span
              aria-hidden="true"
              className={[
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                style.chip,
              ].join(' ')}
            >
              <TriangleAlert className="h-4 w-4" />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className={['mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill', style.bar].join(' ')}
            />
          )}

          <div className="min-w-0 flex-1">
            <h2
              id={headingId}
              className="text-base font-extrabold leading-snug tracking-tight text-text"
            >
              {request?.title ?? ''}
            </h2>

            {request?.description ? (
              <div className="mt-1.5 text-sm leading-[1.7] text-muted">
                {request.description}
              </div>
            ) : null}
          </div>
        </div>

        {request?.details && request.details.length > 0 ? (
          <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 rounded-md bg-surface2 p-3">
            {request.details.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm leading-[1.6] text-text">
                <span
                  aria-hidden="true"
                  className={['mt-2 h-1 w-1 shrink-0 rounded-pill', style.bar].join(' ')}
                />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => onResolve(true)}
            className={[
              'inline-flex min-h-[50px] w-full items-center justify-center rounded-md border border-transparent px-4 text-base font-semibold text-bg transition-[filter] duration-150 hover:brightness-110 active:scale-[0.985]',
              danger ? 'bg-danger' : 'bg-accent',
            ].join(' ')}
          >
            {request?.confirmLabel ?? '确认'}
          </button>
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="inline-flex min-h-[50px] w-full items-center justify-center rounded-md border border-border-strong bg-surface px-4 text-base font-semibold text-text transition-colors hover:border-accent hover:text-accent active:scale-[0.985]"
          >
            {request?.cancelLabel ?? '取消'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
