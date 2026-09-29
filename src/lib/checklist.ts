/**
 * 进阶条件自动拆分（v2 新增功能 · 需求 ②「进阶条件可打勾」）。
 *
 * **关键：不需要改任何数据。**
 *
 * 站内 `progressionStandard` 的真实写法是：
 * ```
 * 3 组 × 50 次，全程直体成线、下沉至胸部近墙、无耸肩借力。
 * 保持 2 分钟，双臂撑直、身体垂直成线、脚跟轻靠墙且颈部无负荷。
 * ```
 * 逗号前后天然是「数量目标 + 若干条质量要求」，切开就正好是一张可勾选清单：
 * ```
 * ☐ 3 组 × 50 次          ← 数量目标（quantity）
 * ☐ 全程直体成线          ← 质量要求（quality）
 * ☐ 下沉至胸部近墙        ← 质量要求（quality）
 * ☐ 无耸肩借力            ← 质量要求（quality）
 * ```
 * 每一条都是可以从动作里自检的短句，逐项勾满 = 这一式过关。
 */

/** 单条进阶条件 */
export interface ProgressionGoal {
  /** 在清单中的下标（勾选状态按此下标存储） */
  index: number;
  /** 条件文本（已去掉句末标点） */
  text: string;
  /** 数量目标 / 质量要求 —— UI 用不同图标区分 */
  kind: 'quantity' | 'quality';
}

/** 分句符：中文逗号 / 顿号 / 分号 + 半角对应 */
const SEGMENT_SEPARATOR = /[，,；;、]/;

/** 句末标点（拆完后逐条剥掉） */
const TRAILING_PUNCTUATION = /[。.！!？?]+$/;

/** 判定是否为数量目标（含「组 × 次」或「保持 N 秒/分钟」） */
function isQuantityGoal(text: string): boolean {
  return /\d+\s*组\s*[×xX*]|\d+(?:\.\d+)?\s*(?:秒|分钟)/.test(text);
}

/**
 * 拆分一条 `progressionStandard` 为可勾选清单。
 *
 * - 至少返回 1 条（无分隔符时整句作为唯一条件，不会返回空清单导致 UI 无内容）；
 * - 过短的碎片（< 2 字）会被丢弃；
 * - 首条若含计量数字，标记为 `quantity`，其余为 `quality`。
 *
 * @example
 * splitProgressionGoals('3 组 × 50 次，全程直体成线、无耸肩借力。')
 * // [
 * //   { index: 0, text: '3 组 × 50 次', kind: 'quantity' },
 * //   { index: 1, text: '全程直体成线', kind: 'quality' },
 * //   { index: 2, text: '无耸肩借力', kind: 'quality' },
 * // ]
 */
export function splitProgressionGoals(progressionStandard: string): ProgressionGoal[] {
  const segments = progressionStandard
    .split(SEGMENT_SEPARATOR)
    .map((segment) => segment.replace(TRAILING_PUNCTUATION, '').trim())
    .filter((segment) => segment.length >= 2);

  if (segments.length === 0) {
    const fallback = progressionStandard.replace(TRAILING_PUNCTUATION, '').trim();
    return fallback === ''
      ? []
      : [{ index: 0, text: fallback, kind: isQuantityGoal(fallback) ? 'quantity' : 'quality' }];
  }

  return segments.map((text, index) => ({
    index,
    text,
    kind: isQuantityGoal(text) ? 'quantity' : 'quality',
  }));
}

/** 勾选满判定：全部条件都为 true */
export function allChecked(checks: boolean[] | undefined, total: number): boolean {
  if (total === 0) return true;
  if (!checks || checks.length !== total) return false;
  return checks.every(Boolean);
}

/** 已勾选条数 */
export function checkedCount(checks: boolean[] | undefined, total: number): number {
  if (!checks) return 0;
  return checks.slice(0, total).filter(Boolean).length;
}

/** 切换某一条并返回新数组（保持长度与总数一致） */
export function toggleCheck(
  checks: boolean[] | undefined,
  total: number,
  index: number,
): boolean[] {
  const next = Array.from({ length: total }, (_, i) => checks?.[i] ?? false);
  next[index] = !next[index];
  return next;
}
