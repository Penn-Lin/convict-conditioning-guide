/**
 * gen-sw.mjs —— 构建后生成 `dist/sw.js`（PWA Service Worker）。
 *
 * ## 为什么自己写，而不是装 `vite-plugin-pwa` / Workbox
 *
 * 本项目的依赖策略是「能不加就不加」（见 README「已知坑」第 1 条：改依赖必须同步锁文件，
 * 而 Cloudflare 跑的是严格 `npm clean-install`）。Workbox 会带进十几个传递依赖，
 * 换来的能力（预缓存 + 版本清理）用不到 100 行就写完了。所以这里保持零依赖。
 *
 * ## 缓存策略（三层，按内容的可变性分开）
 *
 * | 类别 | 策略 | 缓存名 | 理由 |
 * |---|---|---|---|
 * | 应用外壳（HTML / JS / CSS / 图标 / manifest / sitemap） | 安装期预缓存，缓存优先 | `cc-shell-<构建哈希>` | 文件名带内容哈希或本身极少变；缓存名带哈希 ⇒ 新版本自动淘汰旧缓存 |
 * | 页面导航 | **网络优先**，离线回退到缓存的 `index.html` | 同上 | 保证在线时永远是最新版本；离线时 SPA 回退照常工作 |
 * | 动作图 `/actions/*` | 缓存优先 + 按需填充 | `cc-images-v1` | 120 张共 6.2 MB，安装期全量预缓存对手机太重；看过哪张就离线有哪张 |
 *
 * ## 两个刻意的选择
 *
 * 1. **`skipWaiting` + `clients.claim`，但不自动刷新页面。**
 *    刷新交给下一次导航（导航是网络优先的，本来就会拿到最新内容），
 *    避免用户在「记录这次训练」填了一半时被一次重载打断。
 * 2. **逐个 `fetch` + `cache.put`，而不是 `cache.addAll`。**
 *    `addAll` 只要有一个 URL 不是 2xx 就整批失败 ⇒ `install` 失败 ⇒ SW 永远装不上，
 *    而且用户侧完全看不出发生了什么。逐个缓存时单个失败直接跳过。
 *
 * ## 产物
 *
 * `dist/sw.js`（**不进仓库**，`dist/` 已被 gitignore）。末尾会做一次自检：
 * manifest 可解析、声明的每个图标都真实存在、index.html 已接线 manifest。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/** 项目根目录（本脚本位于 `<root>/scripts/`，故上溯一层） */
const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** 构建产物目录 */
const DIST = join(PROJECT_ROOT, 'dist');

/** Service Worker 输出路径 */
const SW_FILE = join(DIST, 'sw.js');

/** 动作图前缀：走运行时缓存，不进预缓存清单 */
const IMAGE_PREFIX = 'actions/';

/** 动作图缓存名。**换了图片内容（同名覆盖）时必须把这个号 +1**，否则旧图永远留在设备上 */
const IMAGE_CACHE = 'cc-images-v1';

/** 不进预缓存清单的文件 */
const EXCLUDED = new Set(['sw.js']);

/**
 * 递归列出 `dist/` 下所有文件的相对路径（POSIX 分隔符）。
 *
 * @param {string} dir 起始目录
 * @param {string} [prefix] 当前前缀
 * @returns {string[]}
 */
function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walk(join(dir, entry.name), rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

/** 内容哈希（前 12 位十六进制） */
function hash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 12);
}

/* ---------------------------------------------------------------------------
 * 收集清单
 * ------------------------------------------------------------------------ */

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('[gen-sw] 找不到 dist/index.html —— 请先跑 vite build。');
  process.exit(1);
}

/** 全部产物文件（相对 dist 的 POSIX 路径） */
const files = walk(DIST).sort();

/** 应用外壳（预缓存） */
const shell = files.filter((f) => !EXCLUDED.has(f) && !f.startsWith(IMAGE_PREFIX));

/** 动作图（运行时缓存，不预缓存） */
const images = files.filter((f) => f.startsWith(IMAGE_PREFIX));

/** 外壳清单：每条 `<文件哈希>\t<URL>` —— 文件内容变了哈希就变，构建版本随之变化 */
const shellEntries = shell.map((f) => `${hash(readFileSync(join(DIST, f)))}\t/${f}`);

/** 构建版本 = 外壳清单整体哈希（任意外壳文件变化都会产生新版本号） */
const VERSION = hash(shellEntries.join('\n'));

/** 预缓存 URL 列表（/index.html 必在，root 路径由它兜底） */
const precacheUrls = shell.map((f) => `/${f}`);

/* ---------------------------------------------------------------------------
 * 渲染 SW 源码
 * ------------------------------------------------------------------------ */

const swSource = `/* eslint-disable */
/**
 * 本文件由 scripts/gen-sw.mjs 于构建期生成，**请勿手工编辑**。
 * 构建版本：${VERSION}
 * 预缓存 ${precacheUrls.length} 个外壳资源；动作图（${images.length} 张）走运行时缓存。
 */
const VERSION = '${VERSION}';
const SHELL = ${JSON.stringify(precacheUrls, null, 2)};
const SHELL_CACHE = 'cc-shell-' + VERSION;
const IMAGE_CACHE = '${IMAGE_CACHE}';
const IMAGE_PREFIX = '/${IMAGE_PREFIX}';
const OFFLINE_FALLBACK = '/index.html';
const KEEP = [SHELL_CACHE, IMAGE_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // 逐个缓存：单个 404 不应该让整次安装失败（那样 SW 会静默地永远装不上）
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'reload' });
            if (res && res.ok) await cache.put(url, res);
          } catch (err) {
            /* 忽略单个失败 */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => KEEP.indexOf(name) === -1).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/** 能缓存吗：同源、GET、状态 200（206 / opaque 一律不缓存） */
function cacheable(req, res) {
  return res && res.ok && res.status === 200 && req.method === 'GET';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ① 页面导航：网络优先 —— 在线时永远拿最新版本，离线时回退到缓存的应用外壳
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (cacheable(req, res)) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(OFFLINE_FALLBACK, copy)).catch(() => {});
          }
          return res;
        } catch (err) {
          const cached = await caches.match(OFFLINE_FALLBACK);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // ② 动作图：缓存优先 + 按需填充（图片内容不可变，缓存命中即返回）
  if (url.pathname.startsWith(IMAGE_PREFIX)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (cacheable(req, res)) cache.put(req, res.clone()).catch(() => {});
          return res;
        } catch (err) {
          return Response.error();
        }
      })()
    );
    return;
  }

  // ③ 其余同源资源（文件名带内容哈希的 JS / CSS、图标、manifest 等）：缓存优先
  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (cacheable(req, res) && res.type === 'basic') {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        return Response.error();
      }
    })()
  );
});
`;

writeFileSync(SW_FILE, swSource, 'utf8');

/* ---------------------------------------------------------------------------
 * 自检：PWA 的接线全是「按约定路径拼地址」，错了就是静默失败
 * ------------------------------------------------------------------------ */

const problems = [];

// ① manifest 可解析
let manifest = null;
try {
  manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
} catch (err) {
  problems.push(`dist/manifest.json 缺失或不是合法 JSON：${err.message}`);
}

if (manifest) {
  if (!manifest.name || !manifest.short_name) problems.push('manifest 缺少 name / short_name');
  if (manifest.display !== 'standalone' && manifest.display !== 'fullscreen') {
    problems.push('manifest 的 display 不是 standalone / fullscreen，桌面端不会作为应用安装');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    problems.push('manifest 没有声明任何 icons，浏览器不会提供安装入口');
  } else {
    // ② 每个图标都要真实存在（跳过 ?v= 查询串）
    for (const icon of manifest.icons) {
      const path = String(icon.src).split('?')[0].replace(/^\//, '');
      if (!files.includes(path)) problems.push(`manifest 声明的图标不存在：${icon.src}`);
    }
    const sizes = manifest.icons.map((i) => i.sizes);
    if (!sizes.includes('192x192') || !sizes.includes('512x512')) {
      problems.push('manifest 必须同时提供 192x192 与 512x512（Chrome 安装的最低要求）');
    }
    if (!manifest.icons.some((i) => i.purpose === 'maskable')) {
      problems.push('manifest 缺少 purpose=maskable 的图标（Android 上会被裁成方角）');
    }
    if (!manifest.icons.some((i) => i.purpose === 'any')) {
      problems.push('manifest 缺少 purpose=any 的图标');
    }
  }
}

// ③ index.html 必须接线 manifest，否则前两条全白做
const html = existsSync(join(DIST, 'index.html'))
  ? readFileSync(join(DIST, 'index.html'), 'utf8')
  : '';
if (!html.includes('rel="manifest"')) {
  problems.push('dist/index.html 里没有 <link rel="manifest">，浏览器不会启用 PWA');
}
if (!html.includes('apple-touch-icon')) {
  problems.push('dist/index.html 里没有 apple-touch-icon，iOS 添加到主屏会没有图标');
}

if (problems.length > 0) {
  console.error('[gen-sw] PWA 自检未通过：');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log(`[gen-sw] 构建版本  : ${VERSION}`);
console.log(`[gen-sw] 预缓存外壳: ${precacheUrls.length} 个文件`);
console.log(`[gen-sw] 运行时缓存: ${images.length} 张动作图（按需）`);
console.log(`[gen-sw] 已写入    : dist/sw.js`);
console.log(`[gen-sw] PWA 自检  : 通过（manifest / 图标 / index.html 接线）`);
