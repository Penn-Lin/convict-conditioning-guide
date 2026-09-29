import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Home } from '@/pages/Home';
import { ArtsOverview } from '@/pages/ArtsOverview';
import { ArtDetail } from '@/pages/ArtDetail';
import { MoveDetail } from '@/pages/MoveDetail';
import { Plan } from '@/pages/Plan';
import { Principles } from '@/pages/Principles';
import { About } from '@/pages/About';
import { NotFound } from '@/pages/NotFound';

/**
 * 应用根组件：装配 BrowserRouter 与路由骨架（架构 §4.1）。
 *
 * 路由表（**全部包裹在 `AppLayout` 内**——顶栏 / 主区 / 底部标签栏 / 页脚为全站骨架）：
 * - `/`                      首页（继续训练 + 六艺进度）
 * - `/arts`                  六艺总览
 * - `/arts/:artSlug`         六艺详情（进度时间线）
 * - `/arts/:artSlug/:stepNo` 十式详情（核心页：动作指导 + 进阶条件打卡）
 * - `/plan`                  今日训练计划（v2 新增：动态生成 + 解释 + 记录闭环）
 * - `/principles`            训练原则
 * - `/about`                 关于 / 免责声明
 * - `*`                      404 兜底
 *
 * 采用**无路径父级路由**（`<Route element={<AppLayout />}>`）承载嵌套：
 * 所有路由共享同一 Header / BottomNav / Footer 布局。
 *
 * 【dev-only 路由】（架构 §5.6）`/dev/ui` 通用组件视觉自检页。
 * 用 `import.meta.env.DEV` 守卫 + 条件 `lazy` 动态导入：Vite 在生产构建时把
 * `import.meta.env.DEV` 常量折叠为 `false`，`lazy(() => import('@/dev/UiShowcase'))`
 * 变成不可达代码被整体剔除 —— 生产产物完全不含 dev 展示页。
 */
const UiShowcase = import.meta.env.DEV
  ? lazy(() => import('@/dev/UiShowcase'))
  : null;

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 全站布局：所有页面路由共享 Header / BottomNav / Footer */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/arts" element={<ArtsOverview />} />
          <Route path="/arts/:artSlug" element={<ArtDetail />} />
          <Route path="/arts/:artSlug/:stepNo" element={<MoveDetail />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/principles" element={<Principles />} />
          <Route path="/about" element={<About />} />

          {/* 404 兜底（同样包在布局内，保留顶栏 / 页脚） */}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* dev-only：组件视觉自检页（生产构建剔除） */}
        {import.meta.env.DEV && UiShowcase && (
          <Route
            path="/dev/ui"
            element={
              <Suspense fallback={null}>
                <UiShowcase />
              </Suspense>
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}
