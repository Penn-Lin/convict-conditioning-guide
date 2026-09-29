/**
 * AppLayout —— 全站布局骨架（架构 §2.5 / §6.2 / §9.6 · T07）。
 *
 * 结构：顶栏 `Header` + 主区 `<Outlet />` + 页脚 `Footer`。
 *
 * 关键行为：
 * - **路由切换后滚动复位**：监听 `pathname` 变化执行 `window.scrollTo`。
 *   使用 `behavior: 'instant'` 强制**瞬时**回顶 —— `index.css` 全局设置了
 *   `html { scroll-behavior: smooth }`（服务于页内锚点），若用默认行为会让回顶
 *   变成动画，导致切换后 `window.scrollY` 短时间不为 0；强制 instant 保证
 *   路由切换后立即回到顶部（`window.scrollY === 0`）。
 * - **T08 免责提示条挂载**：在**顶栏之上、主区之前**渲染 `<DisclaimerBar />`
 *   （首次访问显示的安全提示条，可关闭并持久化）。
 *
 * 语义说明：主区用 `<div>` 而非 `<main>` 包裹 —— 当前 7 个页面（占位）与后续
 * T09/T10 页面**自身**渲染 `<main>` 地标，若此处再用 `<main>` 会出现两个
 * `<main>`（违反「每页唯一 main」）。故由页面持有 main 地标，布局只提供容器。
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DisclaimerBar } from '@/components/layout/DisclaimerBar';

/**
 * 全站布局。
 *
 * @example
 * // 作为父级路由的 element，包裹全部页面路由：
 * <Route element={<AppLayout />}>
 *   <Route path="/" element={<Home />} />
 * </Route>
 */
export function AppLayout() {
  const { pathname } = useLocation();

  // 路由切换 → 瞬时回顶（避免全局 smooth 动画影响断言与体验）。
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      {/* T08 · 首访安全提示条（P0-7）：顶栏之上、主区之前。
          T13 修复：免责条原为地标之外的顶层 <aside role="note">，axe 报 region 违规。
          现包一层具名 <section aria-label>（即 region 地标），把内容纳入地标；
          视觉位置（仍在最顶端）与行为（可关闭 + localStorage 持久化）均不变。 */}
      <section aria-label="安全提示">
        <DisclaimerBar />
      </section>

      <Header />

      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>

      <Footer />
    </div>
  );
}
