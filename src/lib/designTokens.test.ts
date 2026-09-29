/**
 * 设计系统守卫测试。
 *
 * 这个文件是因为踩过一次真实的坑才存在的：
 * `bg-art-pushups/8` 里的 `/8` 不在 Tailwind 默认 opacity 刻度（5 的倍数）上，
 * **Tailwind 不报错、也不生成这个类** —— 于是六艺淡底在浏览器里静默消失，
 * 表现只是「颜色好像不太对」，排查成本极高。
 *
 * 所以这里做两件事：
 * 1. 静态扫描 `src/**` 里所有透明度修饰符，拒绝非 5 的倍数；
 * 2. 断言六艺主题的类名结构完整（每个色相都有浅 / 深两套）。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ART_THEME } from '@/lib/artTheme';
import { ART_ORDER } from '@/lib/constants';

/** 递归收集 src 下的源码文件（跳过测试自身） */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** 匹配类名里的透明度修饰符，如 `bg-art-pushups/8` */
const ALPHA_PATTERN =
  /(?:^|[\s'"`])(?:bg|text|border|ring|divide|stroke|fill|from|via|to|shadow|outline|accent|decoration|placeholder|caret)-[a-zA-Z0-9-]+\/(\d+)/g;

/**
 * 去掉注释后再扫描。
 *
 * 本文件的存在理由是「类名没被 Tailwind 生成」，而注释里写错类名不会影响构建 ——
 * 不剥注释的话，文档示例反而会把守卫测红（真发生过一次）。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('design tokens · Tailwind 透明度刻度守卫', () => {
  it('src 下不存在非 5 倍数的透明度修饰符', () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles('src')) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(ALPHA_PATTERN)) {
        const value = Number(match[1]);
        if (value % 5 !== 0) {
          offenders.push(`${file}: ${match[0].trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('六艺主题的每个色相都提供浅 / 深两套处理', () => {
    for (const slug of ART_ORDER) {
      const theme = ART_THEME[slug];
      expect(theme.solid, `${slug} 缺 solid`).toContain(`bg-art-${slug}`);
      expect(theme.solid, `${slug} 缺深色分支`).toContain(`dark:bg-art-${slug}`);
      expect(theme.soft, `${slug} 缺淡底`).toContain(`bg-art-${slug}/10`);
      expect(theme.text, `${slug} 缺色相文字`).toContain(`text-art-${slug}`);
      expect(theme.bar, `${slug} 缺进度条色`).toContain(`bg-art-${slug}`);
    }
  });

  it('实心徽章不用 text-white（深色主题下会掉到 2.2:1）', () => {
    for (const slug of ART_ORDER) {
      expect(ART_THEME[slug].solid).not.toContain('text-white');
      expect(ART_THEME[slug].solid).toContain('text-bg');
    }
  });
});
