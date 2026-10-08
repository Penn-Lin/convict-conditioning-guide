/**
 * useConfirm —— 全站统一的二次确认入口（v5 新增）。
 *
 * 用法就是一个 `await`：
 * ```tsx
 * const confirm = useConfirm();
 *
 * const ok = await confirm({
 *   title: `完成第 ${stepNo} 式「${name}」？`,
 *   description: `确认后将进入第 ${stepNo + 1} 式。`,
 *   confirmLabel: '确认完成',
 * });
 * if (!ok) return;
 * completeStep(slug, stepNo);
 * ```
 *
 * ## 为什么做成 provider + hook，而不是各处自己写一个弹窗
 * 1. **同一时刻只可能有一个确认**。若每个页面各挂一个 `<dialog>`，
 *    迟早会出现「两个模态同时打开」——浏览器会抛
 *    `Failed to execute 'showModal'`，且用户看到的是叠在一起的遮罩。
 * 2. **调用点保持同步语义**。「删掉一半数据再补回来」这类误操作，
 *    用手写的 `open` state 很容易写成「先执行、再弹窗问」，那就白问了。
 *    返回 Promise 的写法天然要求先问后做。
 *
 * Provider 挂在 `AppLayout`（与 `TrainingProvider` 同级），因此任意页面、
 * 任意抽屉里都能用；它渲染的 `<dialog>` 位于页面内容之外，
 * 在已经打开的 `Sheet` 之上用 `showModal()` 打开会自动进入顶层，
 * 不需要任何 z-index 协调。
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { ConfirmRequest } from '@/components/ui/ConfirmDialog';

/** `confirm()` 的签名 */
export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * 二次确认 Provider。
 *
 * @example
 * <ConfirmProvider><AppLayout /></ConfirmProvider>
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // 上一笔还没人回答就被新请求顶掉时，按「取消」结清 ——
    // 否则那个 await 会永远挂着，调用方后面的代码静默不执行。
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setRequest(next);
      setOpen(true);
    });
  }, []);

  /** 收口：无论确认 / 取消 / Esc，都只在这里结清一次 */
  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    resolve?.(confirmed);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {/* 保留 request 不清空：关闭动画期间内容不能变成空白 */}
      <ConfirmDialog open={open} request={request} onResolve={settle} />
    </ConfirmContext.Provider>
  );
}

/** 取确认函数（必须在 `ConfirmProvider` 内使用） */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (ctx === null) {
    throw new Error('useConfirm 必须在 <ConfirmProvider> 内使用');
  }
  return ctx;
}
