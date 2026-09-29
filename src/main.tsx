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
