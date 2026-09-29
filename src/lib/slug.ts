/**
 * slug 与路径生成（架构 §4.4 / §5.1 / §9.6）。
 *
 * 规则（唯一真源，禁止在别处硬编码字符串拼路径）：
 * - Move slug：`{artSlug}-{stepNo 补零 2 位}`，如 `pushups-05`。
 * - 详情路由：`/arts/{artSlug}/{stepNo}`（不使用 move slug）。
 *
 * 【v1.2 变更】原位图路径 helper `artCoverPath` / `moveImagePath` **已废弃删除**。
 * 【v1.3 变更】姿态/矢量渲染方案整体停用，改为图位占位（`FigureSlot` 预留真实图片位）；
 * 本文件只保留 slug 与路由路径生成，不再涉及封面/图片路径。
 *
 * 本文件为纯函数工具，无副作用。
 */
import type { ArtSlug } from '@/types';
import { MAX_STEP_NO, MIN_STEP_NO } from '@/lib/constants';

/**
 * 生成 Move slug。
 *
 * @example
 * moveSlug('pushups', 5)          // 'pushups-05'
 * moveSlug('leg-raises', 3)       // 'leg-raises-03'
 * moveSlug('handstand-pushups', 10) // 'handstand-pushups-10'
 */
export const moveSlug = (artSlug: ArtSlug, stepNo: number): string =>
  `${artSlug}-${String(stepNo).padStart(2, '0')}`;

/**
 * 生成十式详情页路由路径。
 *
 * @example
 * moveHref('pushups', 2) // '/arts/pushups/2'
 */
export const moveHref = (artSlug: ArtSlug, stepNo: number): string =>
  `/arts/${artSlug}/${stepNo}`;

/**
 * 判断序号是否为合法式号（1–10 的整数）。
 *
 * @param value 待校验的数值（路由参数经 `Number()` 转换后传入）
 */
export function isValidStepNo(value: number): boolean {
  return (
    Number.isInteger(value) && value >= MIN_STEP_NO && value <= MAX_STEP_NO
  );
}

/**
 * 解析路由参数 `stepNo` 为合法式号。
 *
 * @param raw 原始字符串（可能为 `undefined`，如路由未匹配）
 * @returns 合法则返回数字，否则返回 `undefined`
 *
 * @example
 * parseStepNo('5')  // 5
 * parseStepNo('11') // undefined
 * parseStepNo('x')  // undefined
 */
export function parseStepNo(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = Number(raw);
  return isValidStepNo(value) ? value : undefined;
}
