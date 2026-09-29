/**
 * SEO 工具：统一设置每页 `document.title` 与 `meta[name=description]`（架构 §9.6 · P0-15）。
 */
import { useEffect } from 'react';

/** `meta[name="description"]` 的选择器常量 */
const DESCRIPTION_SELECTOR = 'meta[name="description"]';

/**
 * 设置当前页面的标题与描述。
 *
 * - `title` 非空时写入 `document.title`。
 * - `description` 非空时写入 `meta[name=description]`（不存在则动态创建）。
 * - SSR 安全：`typeof document === 'undefined'` 时直接跳过。
 *
 * @param title       页面标题（建议「本页 · 站点名」格式）
 * @param description 页面描述（可选）
 */
export function useDocumentMeta(title: string, description?: string): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (title) {
      document.title = title;
    }

    if (description) {
      let meta = document.querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
  }, [title, description]);
}
