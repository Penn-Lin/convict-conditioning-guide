#!/usr/bin/env node
/**
 * check-deploy.mjs —— 部署目标守卫（作用于构建产物 `dist/`）。
 *
 * ## 为什么需要它
 *
 * 现在托管在 Cloudflare **Pages**。Pages 判断「这是不是一个单页应用」的方式是
 * **看输出目录里有没有顶层 `404.html`**：
 *
 *   - 没有 `404.html` → 认定为 SPA → 任何未匹配的路径都返回 `index.html`；
 *   - 有 `404.html`    → 认定有自定义 404 页 → 未匹配的路径**真的返回 404**。
 *
 * 而 `/arts/pushups/5` 这类深层路由在服务器上并不存在对应文件，全靠上面那条兜底。
 * 也就是说：**只要 dist/ 里出现一个顶层 404.html，全站深链刷新立刻全挂 404** ——
 * 而 `vite build`、`tsc`、单测、Cloudflare 的部署日志**全都是绿的**。
 * 这类「构建全绿、线上半残」的静默失败，正是本项目一贯要给构建期守卫兜住的。
 *
 * 同理 `_redirects` 里若写 `/* /index.html 200`，会被 Pages 判定为重定向死循环
 * （历史上 Workers 校验器也报过同一个错，code 100324）。
 *
 * ## 运行
 *
 * 挂在 `npm run build` 里，紧跟 `vite build` 之后。单独跑：
 *   node scripts/check-deploy.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');

/** 出问题的文件 → 为什么不行 */
const problems = [];

/* ① 顶层 404.html：会用掉 Pages 的 SPA 自动兜底 */
if (existsSync(join(DIST, '404.html'))) {
  problems.push(
    'dist/404.html 存在 —— Cloudflare Pages 会因此关闭 SPA 兜底，' +
      '所有深层路由（如 /arts/pushups/5）刷新将直接 404。请删掉 public/404.html。',
  );
}

/* ② _redirects：Pages 会把 `/* /index.html 200` 判成死循环 */
const redirects = join(DIST, '_redirects');
if (existsSync(redirects)) {
  problems.push(
    'dist/_redirects 存在 —— Pages 不需要它（SPA 兜底是自动的），' +
      '而 `/* /index.html 200` 这类规则会被判为重定向死循环。请从 public/ 移除。',
  );
}

/* ③ 入口本身必须在 */
if (!existsSync(join(DIST, 'index.html'))) {
  problems.push('dist/index.html 不存在 —— 构建产物不完整。');
}

/* ④ vite build 的输出目录不该混进 Pages Functions 的入口文件 */
for (const f of ['_worker.js', '_routes.json']) {
  if (existsSync(join(DIST, f))) {
    problems.push(`dist/${f} 存在 —— 这是 Pages Functions 的入口，本站是纯静态站点，不该有。`);
  }
}

if (problems.length > 0) {
  console.error('');
  console.error('✖ [check-deploy] 部署产物有问题：');
  for (const p of problems) console.error(`   · ${p}`);
  console.error('');
  process.exit(1);
}

const size = readFileSync(join(DIST, 'index.html'), 'utf8').length;
console.log(
  `✓ [check-deploy] Pages 产物就绪（无 404.html / 无 _redirects，index.html ${size} B，SPA 兜底可用）。`,
);
