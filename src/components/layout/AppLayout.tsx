/**
 * AppLayout —— 全站布局骨架（v2）。
 *
 * 结构：安全提示条 → 顶栏 `Header` → 主区 `<Outlet />` → 底部标签栏 `BottomNav` → 页脚。
 *
 * v2 变化：
 * - **挂载 `TrainingProvider`**：全站共享同一份训练状态实例。
 *   若各页面各调一次 hook，就会出现「A 处打卡，B 处不更新」的经典本地状态分裂。
 * - **新增移动端底部标签栏**（`< md` 显示）：首页 / 六艺 / 训练 / 原则，
 *   训练中切换页面的成本从「三次点击」降到「一次」。
 *
 * 关键行为：
 * - **路由切换后滚动复位**：`behavior: 'instant'` 强制瞬时回顶 ——
 *   `index.css` 全局设置了 `html { scroll-behavior: smooth }`（服务于页内锚点），
 *   用默认行为会让回顶变成动画。页面内 `#anchor` 跳转不受影响（同 pathname 不触发）。
 */
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DisclaimerBar } from '@/components/layout/DisclaimerBar';
import { BottomNav } from '@/components/ui/BottomNav';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { TrainingProvider } from '@/hooks/TrainingProvider';

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
  const { pathname, hash } = useLocation();

  // 路由切换 → 瞬时回顶（带 #anchor 的跳转交给浏览器处理，不抢）
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);

  return (
    <TrainingProvider>
      <div className="flex min-h-screen flex-col bg-bg text-text">
        <section aria-label="安全提示">
          <DisclaimerBar />
        </section>

        <Header />

        <div className="flex flex-1 flex-col">
          {/*
            错误边界只包页面内容，不包 Header / BottomNav / Footer ——
            这样万一一页渲染崩了，用户还能靠底部导航切走，不至于整站白屏。
            `key={pathname}` 让路由一变化就自动复位，不必手动刷新。
          */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>

        <Footer />

        {/* 移动端底部标签栏（< md） */}
        <BottomNav />
      </div>
    </TrainingProvider>
  );
}
