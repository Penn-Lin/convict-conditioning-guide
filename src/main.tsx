import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/App';
import '@/index.css';

/**
 * React 挂载入口。
 * 主题的 `<html class="dark">` 已由 index.html 内联脚本在首屏前完成初始化，
 * 此处仅负责挂载 React 应用。
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('未找到 #root 挂载节点，请检查 index.html');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

/**
 * 注册 PWA Service Worker（`dist/sw.js`，由 `scripts/gen-sw.mjs` 构建期生成）。
 *
 * 几个刻意的取舍：
 * - **只在生产构建注册**：开发期的 HMR 与 SW 的缓存优先策略会互相打架，
 *   出现「代码改了页面不变」的假象。
 * - **等 `load` 之后**再注册：不让 SW 的安装与预缓存去抢首屏的带宽。
 * - **失败只 warn，不做任何 UI 提示**：SW 只是「可离线 / 可安装」的增强，
 *   注册失败（比如浏览器处于隐私模式、或站点不走 HTTPS）不影响正常使用。
 * - **不监听 `controllerchange` 自动刷新**：刷新交给下一次导航
 *   （导航是网络优先的，本来就会拿到最新内容）。自动重载会打断
 *   「记录这次训练」填到一半的用户。
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // 主动查一次更新：浏览器的默认检查受 HTTP 缓存与 24h 节流影响，这里补一次。
        void registration.update();
      })
      .catch((error) => {
        console.warn('[pwa] Service Worker 注册失败，站点仍可正常使用：', error);
      });
  });
}
