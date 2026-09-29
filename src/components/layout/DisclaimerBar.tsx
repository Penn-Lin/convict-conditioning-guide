/**
 * DisclaimerBar —— 顶部「首访安全提示条」（架构 §2.5 / §7 T08；PRD P0-7 · §9 内容安全要求）。
 *
 * 职责：
 * - 首次访问时在页面最上方显示一条**醒目的安全提示**（量力而行 / 循序渐进 /
 *   疼痛即停 / 有伤病先咨询医生），并提供跳转「训练原则」的入口；
 * - **可关闭**：点击关闭按钮后写入 `localStorage`（键 `'disclaimer-dismissed'`），
 *   刷新或再次访问时不再出现；**非强制弹窗**——不阻断正文、不锁焦点、不覆盖内容。
 *
 * 数据持久化：复用 T02 的 `useLocalStorage` hook，但使用**独立于主题键**的
 * 持久化键 `'disclaimer-dismissed'`，二者互不干扰。
 *
 * 可访问性（架构 §9.7 · 本任务硬约束）：
 * - 语义由「警示图标（形状）+ 文字」双重承载，**不单独依赖颜色**（§9.7.2）；
 * - 关闭按钮为原生 `<button type="button">`，键盘（Tab 聚焦 → Enter / Space 激活）可达，
 *   含 `aria-label`；触控目标 **44×44px**（`h-11 w-11`）；
 * - 「查看训练原则」为站内 `<Link>`（不整页刷新）；行内链接按 WCAG 内联链接例外处理；
 * - **零硬编码色值**：仅用 `danger` / `text` / `border` / `surface` 等语义 token，
 *   浅 / 深主题自动适配。
 *
 * 挂载点：由 `AppLayout` 在 `Header` 与主区之间渲染（T07 预留，T08 挂载）。
 */
import { Link } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

/**
 * 「安全提示条已关闭」的持久化键。
 *
 * 说明：**独立于主题键**（`THEME_STORAGE_KEY`），避免两条持久化状态相互影响。
 * 值为布尔，`true` 表示用户已关闭提示条。
 */
export const DISCLAIMER_STORAGE_KEY = 'disclaimer-dismissed';

/** `DisclaimerBar` 的 props */
export interface DisclaimerBarProps {
  /** 附加类名（默认空） */
  className?: string;
}

/**
 * 首访安全提示条。
 *
 * @example
 * // 挂载于 AppLayout（顶栏与主区之间）
 * <DisclaimerBar />
 */
export function DisclaimerBar({ className = '' }: DisclaimerBarProps) {
  /** 提示条是否已被用户关闭；`true` 时整条不渲染（不再占用布局） */
  const [dismissed, setDismissed] = useLocalStorage<boolean>(
    DISCLAIMER_STORAGE_KEY,
    false,
  );

  // 已关闭 → 完全不渲染（非隐藏，避免占位与可达树残留）。
  if (dismissed) return null;

  return (
    <aside
      role="note"
      aria-label="安全提示条"
      className={['border-b border-danger/70 bg-danger/5', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-3">
        {/* 警示图标：装饰，语义已由文案承载 */}
        <ShieldAlert
          aria-hidden="true"
          className="mt-1 h-5 w-5 shrink-0 text-danger"
        />

        {/* 安全提示文案（正文级 16px / 行高 1.7）+ 训练原则入口 */}
        <p className="min-w-0 flex-1 text-base leading-[1.7] text-text">
          量力而行、循序渐进，出现疼痛立即停止；有伤病者请先咨询医生。
          <Link
            to="/principles"
            className="ml-1 font-medium text-danger underline underline-offset-2 hover:opacity-90"
          >
            查看训练原则
          </Link>
        </p>

        {/* 关闭按钮：键盘可达、含 aria-label、触控目标 44×44px */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="关闭安全提示"
          title="关闭安全提示"
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-transparent text-text transition-colors hover:border-border hover:bg-surface"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
