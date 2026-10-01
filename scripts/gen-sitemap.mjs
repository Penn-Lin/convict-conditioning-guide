/**
 * gen-sitemap.mjs —— 构建后生成 `dist/sitemap.xml` 与 `dist/robots.txt`
 * （架构 §2.8 / §7 T11 · PRD P0-15）。
 *
 * 设计要点：
 * 1. **数据派生、不硬编码**：本脚本从 `src/data` 的**源文件**读取真源，而不是把 60 条
 *    动作 URL 写死在这里——
 *      - 4 个静态页（`/`、`/arts`、`/principles`、`/about`）为路由表既有常量；
 *      - **6 个艺页** 的 slug 与顺序取自 `src/data/artsMeta.ts`（按 `order` 升序）；
 *      - **60 个式页** 的 `stepNo` 取自 `src/data/arts/*.ts` 各艺数据文件的 `stepNo` 字段。
 *    这样内容层增删动作 / 调整顺序时，sitemap **自动跟随**，无需改动本脚本。
 *
 * 2. **零依赖**：仅用 Node 内置 `node:fs` / `node:path` / `node:url`，手写 XML 字符串拼接，
 *    **不引入任何 sitemap 库**（架构 §8 依赖极简原则）。
 *
 * 3. **零环境变量也能跑**：站点基准 URL 默认取下面的 `DEFAULT_SITE_URL` 常量；
 *    可以用环境变量 `SITE_URL` 覆盖（Cloudflare 的项目设置里配一个即可）。
 *    这样做是为了让**同一份代码同时部署到 Workers 与 Pages 时，sitemap / robots
 *    能各自指向自己那个域名** —— 换托管平台或绑自定义域名都不必改代码。
 *
 * 4. **容错**：`dist/` 不存在时自动创建；单个数据文件解析不到 `stepNo` 时跳过其式页而非报错
 *    （内容层占位阶段亦能生成合法 sitemap）。
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* ---------------------------------------------------------------------------
 * 站点基准 URL
 *
 * 当前托管在 Cloudflare **Pages**，地址格式为 `<项目名>.pages.dev`。
 * （Workers 静态资源的格式是 `<Worker名>.<账户子域>.workers.dev`，两者不通用；
 *   绑了自有域名就把这里换成自己的域名。）
 * ------------------------------------------------------------------------ */

/** 默认站点地址（没有 `SITE_URL` 环境变量时用它） */
const DEFAULT_SITE_URL = 'https://convict-conditioning-guide.pages.dev';

/** 实际生效的站点地址：环境变量优先，并去掉结尾多余的斜杠 */
const SITE_URL = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

/** 项目根目录（本脚本位于 `<root>/scripts/`，故上溯一层） */
const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** 内容数据目录（`src/data`） */
const DATA_DIR = join(PROJECT_ROOT, 'src', 'data');

/** 各艺动作数据目录（`src/data/arts`） */
const ARTS_DIR = join(DATA_DIR, 'arts');

/** sitemap 输出路径（`dist/sitemap.xml`） */
const OUTPUT_FILE = join(PROJECT_ROOT, 'dist', 'sitemap.xml');

/** robots.txt 输出路径（`dist/robots.txt`） */
const ROBOTS_FILE = join(PROJECT_ROOT, 'dist', 'robots.txt');

/** 路由表既有静态页（架构 §4.1）：路径 → { changefreq, priority } */
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/arts', changefreq: 'weekly', priority: '0.9' },
  { path: '/principles', changefreq: 'monthly', priority: '0.6' },
  { path: '/about', changefreq: 'yearly', priority: '0.4' },
];

/* ---------------------------------------------------------------------------
 * 数据解析（只读源文件，不执行 TS）
 * ------------------------------------------------------------------------ */

/**
 * 从 `artsMeta.ts` 解析「艺 slug + order」，并按 `order` 升序返回。
 *
 * 匹配每个元数据对象的 `slug: '...'` 与紧随其后的 `order: N`。
 *
 * @returns `{ slug, order }[]`（按 order 升序）
 */
function readArtsMeta() {
  const file = join(DATA_DIR, 'artsMeta.ts');
  const source = readFileSync(file, 'utf8');

  const entries = [];
  const pattern = /slug:\s*'([^']+)'[\s\S]*?order:\s*(\d+)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    entries.push({ slug: match[1], order: Number(match[2]) });
  }

  return entries.sort((a, b) => a.order - b.order);
}

/**
 * 扫描 `src/data/arts/*.ts`，返回 `artSlug → 升序 stepNo[]` 的映射。
 *
 * - `artSlug` 取自每条数据顶部的 `artRef: { slug: '...' }`；
 * - `stepNo` 取自每个动作对象的 `stepNo: N` 字段。
 *
 * @returns `Map<string, number[]>`
 */
function readMovesByArt() {
  /** @type {Map<string, Set<number>>} */
  const byArt = new Map();

  if (!existsSync(ARTS_DIR)) return new Map();

  const files = readdirSync(ARTS_DIR).filter((name) => name.endsWith('.ts'));

  for (const name of files) {
    const source = readFileSync(join(ARTS_DIR, name), 'utf8');

    // 该文件对应哪个艺：取首个 artRef.slug
    const artMatch = source.match(/artRef:\s*\{\s*slug:\s*'([^']+)'/);
    if (!artMatch) continue;
    const artSlug = artMatch[1];

    if (!byArt.has(artSlug)) byArt.set(artSlug, new Set());

    // 该文件内所有 `stepNo: N`（行首缩进后紧跟，排除注释/派生字段）
    const stepPattern = /^\s*stepNo:\s*(\d+)/gm;
    let stepMatch;
    while ((stepMatch = stepPattern.exec(source)) !== null) {
      byArt.get(artSlug).add(Number(stepMatch[1]));
    }
  }

  // Set → 升序数组
  const result = new Map();
  for (const [artSlug, steps] of byArt.entries()) {
    result.set(
      artSlug,
      [...steps].sort((a, b) => a - b),
    );
  }
  return result;
}

/* ---------------------------------------------------------------------------
 * URL 清单装配
 * ------------------------------------------------------------------------ */

/**
 * 组装全部 sitemap 条目（去重、保序）。
 *
 * 顺序：首页 → 六艺总览 → 各艺（艺页 + 其十式页，按 order / stepNo）→ 训练原则 → 关于。
 *
 * @returns `{ loc: string, changefreq: string, priority: string }[]`
 */
function buildEntries() {
  const artsMeta = readArtsMeta();
  const movesByArt = readMovesByArt();

  const entries = [];
  const seen = new Set();

  /** 追加一条（按 path 去重） */
  const push = (path, changefreq, priority) => {
    if (seen.has(path)) return;
    seen.add(path);
    entries.push({
      loc: new URL(path, SITE_URL).toString(),
      changefreq,
      priority,
    });
  };

  // ① 静态页：首页 / 六艺总览，先放最前
  push('/', STATIC_PAGES[0].changefreq, STATIC_PAGES[0].priority);
  push('/arts', STATIC_PAGES[1].changefreq, STATIC_PAGES[1].priority);

  // ② 各艺：艺页 + 该艺全部式页
  for (const { slug } of artsMeta) {
    push(`/arts/${slug}`, 'weekly', '0.8');

    const steps = movesByArt.get(slug) ?? [];
    for (const stepNo of steps) {
      push(`/arts/${slug}/${stepNo}`, 'monthly', '0.7');
    }
  }

  // ③ 其余静态页：训练原则 / 关于
  push('/principles', STATIC_PAGES[2].changefreq, STATIC_PAGES[2].priority);
  push('/about', STATIC_PAGES[3].changefreq, STATIC_PAGES[3].priority);

  return entries;
}

/* ---------------------------------------------------------------------------
 * XML 渲染与写出
 * ------------------------------------------------------------------------ */

/** 渲染 sitemap XML 文本 */
function renderSitemap(entries) {
  const lastmod = new Date().toISOString().slice(0, 10);

  const body = entries
    .map((entry) =>
      [
        '  <url>',
        `    <loc>${entry.loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ].join('\n'),
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');
}

/** 渲染 robots.txt 文本（Sitemap 链接必须与站点基准 URL 同源） */
function renderRobots() {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n');
}

/** 主流程 */
function main() {
  const entries = buildEntries();

  const distDir = dirname(OUTPUT_FILE);
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  writeFileSync(OUTPUT_FILE, renderSitemap(entries), 'utf8');

  // robots.txt 也在构建期生成，而不是放 `public/` 里写死 ——
  // 否则换域名（Workers ↔ Pages ↔ 自有域名）时 sitemap.xml 改了、robots 里的 Sitemap 行没改，
  // 两个文件指向不同域名，属于只在抓取日志里才看得见的静默不一致。
  writeFileSync(ROBOTS_FILE, renderRobots(), 'utf8');

  const artCount = readArtsMeta().length;
  const moveCount = entries.filter((entry) => /\/arts\/[^/]+\/\d+$/.test(entry.loc)).length;

  console.log(`[gen-sitemap] base URL : ${SITE_URL}`);
  console.log(`[gen-sitemap] 艺页      : ${artCount}`);
  console.log(`[gen-sitemap] 式页      : ${moveCount}`);
  console.log(`[gen-sitemap] 总条目    : ${entries.length}`);
  console.log(`[gen-sitemap] 已写入    : dist/sitemap.xml + dist/robots.txt`);
}

main();
