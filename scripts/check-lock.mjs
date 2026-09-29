#!/usr/bin/env node
/**
 * 校验 package.json 与 package-lock.json 是否同步。
 *
 * 为什么需要它（真实事故，2026-09-30）：
 * 给项目加了 `vitest` 到 package.json，但**锁文件没被更新**就推了上去。
 * 本地 `npm install` 用的是已存在的 node_modules，一切正常；
 * 直到 Cloudflare 构建跑 `npm clean-install` 才炸：
 *
 *   npm error `npm ci` can only install packages when your package.json and
 *   package-lock.json are in sync.
 *   npm error Missing: vitest@2.1.9 from lock file
 *   ...（另外 29 个传递依赖）
 *
 * 关键教训：**本地能跑 ≠ 锁文件是对的**。CI 用的是 `npm ci`（严格按锁文件装），
 * 和本地 `npm install`（会就地补全）行为完全不同。这个脚本零网络、毫秒级，
 * 直接比对声明与锁定，能在 push 之前把问题拦下来。
 *
 * 挂在 `npm run build` 的最前面，因此本地构建就会失败并给出修复命令。
 *
 * 运行：node scripts/check-lock.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 需要比对的三类依赖 */
const SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];

function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}

let pkg;
let lock;
try {
  pkg = readJson('package.json');
} catch (error) {
  console.error(`[check-lock] 无法读取 package.json：${error.message}`);
  process.exit(1);
}
try {
  lock = readJson('package-lock.json');
} catch (error) {
  console.error(`[check-lock] 无法读取 package-lock.json：${error.message}`);
  process.exit(1);
}

/** lockfileVersion 3 起，根包声明在 packages[''] */
const lockRoot = lock.packages?.[''];
if (!lockRoot) {
  console.error('[check-lock] package-lock.json 结构异常：缺少 packages[""]。');
  process.exit(1);
}

const problems = [];

for (const section of SECTIONS) {
  const declared = pkg[section] ?? {};
  const locked = lockRoot[section] ?? {};
  const lockedPackages = lock.packages ?? {};

  for (const [name, spec] of Object.entries(declared)) {
    if (!(name in locked)) {
      problems.push(`${section} 里的 "${name}" 没有写进锁文件`);
      continue;
    }
    if (locked[name] !== spec) {
      problems.push(
        `${section} 里的 "${name}" 版本范围不一致：package.json=${spec} / lock=${locked[name]}`,
      );
      continue;
    }
    // 传递依赖树里必须真有这个包（npm ci 会按安装路径查找）
    const installed = Object.keys(lockedPackages).some(
      (path) => path === `node_modules/${name}`,
    );
    if (!installed) {
      problems.push(`锁文件里缺少 "${name}" 的安装条目（node_modules/${name}）`);
    }
  }

  for (const name of Object.keys(locked)) {
    if (!(name in declared)) {
      problems.push(`${section} 里的 "${name}" 已从 package.json 删除，但锁文件仍有记录`);
    }
  }
}

if (problems.length > 0) {
  console.error('');
  console.error('✖ [check-lock] package.json 与 package-lock.json 不同步：');
  for (const problem of problems) console.error(`   · ${problem}`);
  console.error('');
  console.error('  修复：npm install --package-lock-only && git add package-lock.json');
  console.error('  （Cloudflare 构建用的是 npm clean-install，锁文件不同步会直接失败）');
  console.error('');
  process.exit(1);
}

console.log('✓ [check-lock] package.json 与 package-lock.json 同步。');
