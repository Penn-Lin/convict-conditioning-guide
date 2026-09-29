/**
 * 训练量阶梯解析（设计文档 §8.1 / §3.2）。
 *
 * **关键设计：难度与训练量严格分离，且不需要新建规则表。**
 *
 * 站内 60 式数据里的 `trainingGoal` 天然就是三档训练量阶梯：
 * ```
 * 初级 1 组 × 8 次 → 中级 2 组 × 12 次 → 升阶 2 组 × 25 次
 * 初级 保持 30 秒 → 中级 保持 1 分钟 → 升阶 保持 2 分钟
 * 初级 1 组 × 5 次（每侧） → 中级 2 组 × 8 次（每侧） → 升阶 2 组 × 10 次（每侧）
 * ```
 * 因此 `volumeLadder` 由数据**派生**，零改动现有 60 式数据、不加一张规则表。
 *
 * 解析失败时回退为单档 `[{sets: 2, perSet: 8}]`，保证引擎永不断链。
 */
import type { MetricKind, VolumeTier } from '@/types/plan';

/** 解析结果 */
export interface ParsedLadder {
  metric: MetricKind;
  /** 三档阶梯（`tier 0 = 初级`、`1 = 中级`、`2 = 升阶`） */
  ladder: VolumeTier[];
  /** 解析失败时的兜底标记（单测 / 数据体检用） */
  fallback: boolean;
}

/** 三档分隔符（数据格式固定为「初级 A → 中级 B → 升阶 C」） */
const TIER_SEPARATOR = '→';

/** 分档中文标签（顺序即 tier 下标） */
export const TIER_LABEL_CN = ['初级', '中级', '升阶'] as const;

/** 保持型的时长单位换算（秒） */
const HOLD_UNIT_SECONDS: ReadonlyArray<[RegExp, number]> = [
  [/^(\d+(?:\.\d+)?)\s*分钟$/, 60],
  [/^(\d+(?:\.\d+)?)\s*分$/, 60],
  [/^(\d+(?:\.\d+)?)\s*秒$/, 1],
];

/** 次数型：`3 组 × 50 次` / `2 组 × 10 次（每侧）` / `1 组 x 8 次` */
const REPS_PATTERN = /(\d+)\s*组\s*[×xX*]\s*(\d+)\s*次/;

/** 单档解析结果 */
interface TierParse {
  metric: MetricKind;
  tier: VolumeTier;
}

/**
 * 解析「保持 1 分钟」这类时长描述为秒。
 *
 * 注意片段带着档位前缀（`初级 保持 30 秒`），因此要从「保持」之后开始取数，
 * 而不是假设它以「保持」开头 —— 这个假设一错，倒立撑前 3 式会全部解析失败。
 */
function parseHoldSeconds(text: string): number | null {
  const marker = text.indexOf('保持');
  if (marker === -1) return null;

  const inner = text.slice(marker + '保持'.length).trim();
  for (const [pattern, unit] of HOLD_UNIT_SECONDS) {
    const matched = inner.match(pattern);
    if (matched) return Math.round(Number(matched[1]) * unit);
  }
  return null;
}

/** 解析单个档位片段；无法识别时返回 `null` */
function parseTierSegment(segment: string): TierParse | null {
  const reps = segment.match(REPS_PATTERN);
  if (reps) {
    return {
      metric: 'reps',
      tier: { sets: Number(reps[1]), perSet: Number(reps[2]) },
    };
  }

  if (segment.includes('保持')) {
    const seconds = parseHoldSeconds(segment);
    if (seconds !== null) {
      return { metric: 'hold', tier: { sets: 1, perSet: seconds } };
    }
  }

  return null;
}

/** 解析兜底值（数据异常时保证引擎仍能产出计划） */
const FALLBACK_TIER: VolumeTier = { sets: 2, perSet: 8 };

/**
 * 从 `Move.trainingGoal` 解析训练量阶梯。
 *
 * @param trainingGoal 原始训练目标文本
 * @returns 计量方式 + 三档阶梯（不足三档时按已有档位补齐为单档，并置 `fallback`）
 *
 * @example
 * parseVolumeLadder('初级 1 组 × 8 次 → 中级 2 组 × 12 次 → 升阶 2 组 × 25 次')
 * // { metric: 'reps', ladder: [{1,8},{2,12},{2,25}], fallback: false }
 *
 * @example
 * parseVolumeLadder('初级 保持 30 秒 → 中级 保持 1 分钟 → 升阶 保持 2 分钟')
 * // { metric: 'hold', ladder: [{1,30},{1,60},{1,120}], fallback: false }
 */
export function parseVolumeLadder(trainingGoal: string): ParsedLadder {
  const segments = trainingGoal
    .split(TIER_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');

  const parsed = segments
    .map(parseTierSegment)
    .filter((item): item is TierParse => item !== null);

  if (parsed.length === 0) {
    return { metric: 'reps', ladder: [FALLBACK_TIER], fallback: true };
  }

  // 计量方式以第一个可识别档位为准（同一式的三档必为同一计量方式）
  const metric = parsed[0].metric;
  const ladder = parsed
    .filter((item) => item.metric === metric)
    .map((item) => item.tier);

  if (ladder.length === 0) {
    return { metric: 'reps', ladder: [FALLBACK_TIER], fallback: true };
  }

  return { metric, ladder, fallback: parsed.length < segments.length };
}

/**
 * 由用户自报的「单次能完成次数」反推训练量档（§3.2）。
 *
 * 在该式的阶梯里找 `perSet ≤ maxReps` 的最大档；找不到则取 `tier 0`。
 *
 * @example
 * // 第 4 式阶梯 [1×8, 2×12, 2×25]，用户能做 12 次 → 命中中级档
 * inferTier([{sets:1,perSet:8},{sets:2,perSet:12},{sets:2,perSet:25}], 12) // 1
 */
export function inferTier(ladder: VolumeTier[], maxReps?: number): number {
  if (maxReps === undefined || !Number.isFinite(maxReps)) return 0;
  for (let i = ladder.length - 1; i >= 0; i -= 1) {
    if (ladder[i].perSet <= maxReps) return i;
  }
  return 0;
}

/** 档位标签：`'中级 2 组 × 15 次'` / `'中级 保持 1 分钟'` */
export function formatTierLabel(
  metric: MetricKind,
  tier: VolumeTier,
  tierIndex: number,
): string {
  const label = TIER_LABEL_CN[tierIndex] ?? `第 ${tierIndex + 1} 档`;
  if (metric === 'hold') return `${label} 保持 ${formatSeconds(tier.perSet)}`;
  return `${label} ${tier.sets} 组 × ${tier.perSet} 次`;
}

/** 把秒数写成中文时长：`30 秒` / `1 分钟` / `2 分 30 秒` */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rest} 秒`;
}

/** 把一组训练量写成 UI 文案：`2 组 × 15 次` / `保持 1 分钟 × 2` / `保持 30 秒` */
export function formatVolume(metric: MetricKind, sets: number, perSet: number): string {
  if (metric === 'hold') {
    return sets <= 1
      ? `保持 ${formatSeconds(perSet)}`
      : `保持 ${formatSeconds(perSet)} × ${sets} 组`;
  }
  return `${sets} 组 × ${perSet} 次`;
}
