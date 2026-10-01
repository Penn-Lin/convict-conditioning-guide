#!/usr/bin/env node
/**
 * [check-figures] 十式动作图资源守卫（零依赖、零网络）。
 *
 * ## 为什么需要它
 *
 * 图挂掉是**静默失败**：页面照常渲染（`MoveFigurePair` 会降级成占位块）、
 * 类型检查通过、单测全绿、`vite build` 成功 —— 只有用户肉眼才发现「这块没图」。
 *
 * 2026-10-01 真实事故：艺 slug 是 **kebab-case**（`leg-raises` / `handstand-pushups`），
 * 而资源目录按数据文件名建成了 camelCase（`legRaises` / `handstandPushups`）——
 * 举腿与倒立撑两艺共 40 张图全部 404，其余四艺正常，因此很难联想到是命名问题。
 *
 * ## 校验内容
 *
 * 1. `public/actions/` 的**子目录集合**必须与 `src/data/artsMeta.ts` 的 slug 集合完全一致
 *    （既查缺失，也查多余 —— 后者能抓出拼错的目录名）；
 * 2. 每个艺目录必须有 `01-1.jpg … 10-2.jpg` 共 20 张。
 *
 * `public/actions/` 不存在时直接跳过 —— 未接入动作图的版本照样能构建。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const META_FILE = join(ROOT, 'src/data/artsMeta.ts');
const FIGURE_DIR = join(ROOT, 'public/actions');

const STEPS = 10;
const PER_STEP = 2;

if (!existsSync(FIGURE_DIR)) {
  console.log('✓ [check-figures] 未接入动作图（public/actions 不存在），跳过。');
  process.exit(0);
}

/** 从 artsMeta.ts 提取六艺 slug（该文件只有这一个 slug 字段来源） */
const slugs = [...readFileSync(META_FILE, 'utf8').matchAll(/slug:\s*'([^']+)'/g)].map(
  (match) => match[1],
);

const dirs = readdirSync(FIGURE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const errors = [];

const missing = slugs.filter((slug) => !dirs.includes(slug));
if (missing.length > 0) {
  errors.push(`缺少资源目录：${missing.join(', ')}`);
}

const extra = dirs.filter((dir) => !slugs.includes(dir));
if (extra.length > 0) {
  errors.push(`多余或拼错的资源目录：${extra.join(', ')}`);
}

for (const slug of slugs) {
  if (!dirs.includes(slug)) continue;
  const files = new Set(readdirSync(join(FIGURE_DIR, slug)));
  const lack = [];
  for (let step = 1; step <= STEPS; step += 1) {
    const padded = String(step).padStart(2, '0');
    for (let index = 1; index <= PER_STEP; index += 1) {
      const name = `${padded}-${index}.jpg`;
      if (!files.has(name)) lack.push(name);
    }
  }
  if (lack.length > 0) {
    errors.push(`${slug} 缺 ${lack.length} 张：${lack.join(', ')}`);
  }
}

if (errors.length > 0) {
  console.error('✗ [check-figures] 动作图资源不一致：');
  for (const line of errors) console.error(`  - ${line}`);
  console.error(
    '\n修复：资源目录名必须与 src/data/artsMeta.ts 的 slug **逐字一致**' +
      '（注意是 kebab-case，如 leg-raises / handstand-pushups）。',
  );
  process.exit(1);
}

const total = slugs.length * STEPS * PER_STEP;
console.log(`✓ [check-figures] 动作图齐全：${slugs.length} 艺 × ${STEPS} 式 × ${PER_STEP} 张 = ${total} 张。`);
