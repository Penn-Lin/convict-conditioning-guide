/**
 * NotFound —— 404 兜底页（路由 `*` · T10）。
 *
 * 组成（友好、克制，不卖萌）：
 * - 提示：404 标识 + 「页面不存在」标题 + 一句说明；
 * - 返回入口：返回首页 / 六艺总览（站内跳转一律 `<Link>`，由 `Button` 承载）。
 *
 * 另外导出 `NotFoundContent`（**纯内容，不含 `<main>`、不写 meta**），供 `MoveDetail`
 * 在「非法参数」时复用，保证「非法路由」与「`*` 兜底」呈现**完全一致**的内容
 * （架构 §4.1：非法 artSlug / stepNo 时页面内部渲染 NotFound 内容）。
 */
import { Compass } from 'lucide-react';
import { useDocumentMeta } from '@/lib/seo';
import { SITE_NAME } from '@/lib/constants';
import { Button } from '@/components/ui/Button';

/** 404 页统一标题（供 `NotFound` 与 `MoveDetail` 复用，保证两处一致） */
export const NOT_FOUND_TITLE = `页面不存在 · ${SITE_NAME}`;

/** 404 页统一描述（供 `NotFound` 与 `MoveDetail` 复用） */
export const NOT_FOUND_DESCRIPTION =
  '你访问的页面不存在。请检查链接是否正确，或从首页 / 六艺总览重新开始。';

/**
 * 404 的**内容体**（不含布局与 meta）。
 *
 * 供 `NotFound` 页面与 `MoveDetail`（非法参数分支）共用，保证二者内容一致。
 */
export function NotFoundContent() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Compass aria-hidden="true" className="h-10 w-10 text-muted" />

      <p className="font-mono text-4xl font-extrabold tracking-tight text-text">
        404
      </p>

      <h1 className="text-2xl font-bold leading-tight text-text">
        页面不存在
      </h1>

      <p className="max-w-prose text-base leading-[1.8] text-muted">
        你访问的地址可能已被移动，或者从未存在。请检查链接是否正确，或从下方入口继续浏览。
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <Button to="/">返回首页</Button>
        <Button to="/arts" variant="secondary">
          浏览六艺总览
        </Button>
      </div>
    </div>
  );
}

/**
 * 404 页面（`*` 兜底路由）。
 *
 * @example
 * <Route path="*" element={<NotFound />} />
 */
export function NotFound() {
  useDocumentMeta(NOT_FOUND_TITLE, NOT_FOUND_DESCRIPTION);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-nav pt-10 sm:px-6">
      <NotFoundContent />
    </main>
  );
}

export default NotFound;
