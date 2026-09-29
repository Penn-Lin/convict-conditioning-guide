/**
 * 优先级打分（设计文档 §5）。
 *
 * ```
 * priority(skill) =
 *       W.recovery   × recoveryNeed         // 0 – 1      恢复缺失度
 *     + W.completion × completionHealth     // 0 – 1      完成度健康度
 *     + W.focus      × planFocus            // 0 – 1      推进链
 *     − W.fatigue    × fatigueLoad          // 0 – 1      疲劳惩罚
 *     − W.overlap    × overlapWithRecent    // 0 – 1      类型重叠惩罚
 *     − W.stall      × stallFlag            // 0 或 1      停滞惩罚
 * ```
 *
 * **3 加分 + 3 扣分，全部先归一化到 0–1 再加权**，因此权重之间量级可直接比较、可调。
 *
 * 最值得注意的一点：「昨天练过就降低优先级」**不是特例写出来的** ——
 * 重叠矩阵里 `[s][s] = 1.0`，所以昨天练过的项目被同一套公式自然扣掉满分项。
 */
import type { ArtSlug } from '@/types';
import type { PriorityBreakdown, SkillSnapshot } from '@/types/plan';
import { ART_ORDER } from '@/lib/constants';

import {
  COMPLETION,
  FATIGUE,
  FOCUS,
  LOAD_TYPE_LABEL,
  OVERLAP_MATRIX,
  RECOVERY,
  WEIGHTS,
} from './config';

/** ① 恢复缺失度（§5.3 ①） */
export function recoveryNeed(daysSinceLast: number | null): number {
  if (daysSinceLast === null) return 1.0;
  const span = RECOVERY.fullDays - RECOVERY.floorDays;
  if (span <= 0) return 1.0;
  const raw = (daysSinceLast - RECOVERY.floorDays) / span;
  return Math.max(0, Math.min(1, raw));
}

/**
 * ② 完成度健康度（§5.3 ②）。
 *
 * 除以 `COMPLETION.maxRatio`(1.2) 是为了容忍「超额完成」不产生畸形高分 ——
 * **这一步最容易漏**，直接把原始完成度当因子值会算错。
 */
export function completionHealth(avgCompletion: number): number {
  return Math.min(avgCompletion, COMPLETION.maxRatio) / COMPLETION.maxRatio;
}

/** ④ 疲劳负荷（§5.3 ④）；低于中性点的疲劳一律记 0 分惩罚 */
export function fatigueLoad(fatigueNow: number): number {
  const raw = (fatigueNow - FATIGUE.neutral) / (5 - FATIGUE.neutral);
  return Math.max(0, Math.min(1, raw));
}

/** ③ 推进链权重（§5.3 ③） */
export function planFocus(snapshot: SkillSnapshot, primaryArt: ArtSlug): number {
  if (snapshot.slug === primaryArt) return FOCUS.primary;
  if (snapshot.status === 'mastered') return FOCUS.mastered;
  return FOCUS.others;
}

/** ⑥ 停滞标记 */
export function stallFlag(snapshot: SkillSnapshot): number {
  return snapshot.status === 'stalled' ? 1 : 0;
}

/**
 * 确定「主练艺」：按原书顺序，第一个尚未全部完成的艺。
 *
 * 这是原书方法论「一门一门推进，不贪多」的载体。
 */
export function primaryArtOf(snapshots: SkillSnapshot[]): ArtSlug {
  const pending = ART_ORDER.find(
    (slug) => snapshots.find((snap) => snap.slug === slug)?.status !== 'mastered',
  );
  return pending ?? ART_ORDER[0];
}

/* ---------------------------------------------------------------------------
 * 因子文案（含真实数值 —— 换一组数据就换一句话，不是写死的）
 * ------------------------------------------------------------------------ */

function recoveryText(snapshot: SkillSnapshot): string {
  if (snapshot.daysSinceLast === null) return '从未训练，恢复完全充分';
  if (snapshot.daysSinceLast < RECOVERY.floorDays) return '刚刚训练过，恢复不足';
  if (snapshot.daysSinceLast < RECOVERY.fullDays) {
    return `已经 ${snapshot.daysSinceLast} 天没有训练`;
  }
  return `已经 ${snapshot.daysSinceLast} 天没有训练，恢复充分`;
}

function completionText(snapshot: SkillSnapshot): string {
  const percent = Math.round(snapshot.avgCompletion * 100);
  if (snapshot.avgCompletion >= 0.95) return `最近完成度稳定（${percent}%）`;
  if (snapshot.avgCompletion < COMPLETION.noHistoryDefault) {
    return `最近完成度偏低（${percent}%）`;
  }
  return `最近完成度正常（${percent}%）`;
}

function focusText(snapshot: SkillSnapshot, primaryArt: ArtSlug): string {
  if (snapshot.slug === primaryArt) return '当前主练项目，优先推进';
  if (snapshot.status === 'mastered') return '十式已全部完成';
  return '非主练项目';
}

function fatigueText(snapshot: SkillSnapshot): string {
  const load = fatigueLoad(snapshot.fatigueNow);
  if (load <= 0) return '疲劳已恢复到中性水平';
  const raw = snapshot.fatigueNow;
  const level = raw >= 4 ? '很累' : '偏累';
  return `上次训练自觉${level}（${raw.toFixed(1)}/5），尚未完全恢复`;
}

function overlapText(snapshot: SkillSnapshot): string {
  const { overlap48h, recentSkills } = snapshot;
  if (overlap48h <= 0 || recentSkills.length === 0) {
    return '48 小时内没有同类负荷';
  }
  const sources = recentSkills
    .map((slug) => ({ slug, value: OVERLAP_MATRIX[slug][snapshot.slug] }))
    .sort((a, b) => b.value - a.value);
  const top = sources[0];
  const own = top.slug === snapshot.slug;
  const label = own ? '本项自己' : '其他项目';
  const names = sources.map((item) => LOAD_TYPE_LABEL[item.slug]).join('、');
  return `48 小时内练过${label}（${names} 负荷重叠 ${Math.round(overlap48h * 100)}%）`;
}

function stallText(snapshot: SkillSnapshot): string {
  return snapshot.status === 'stalled' ? '连续多次未完成，需要休息' : '没有停滞';
}

/* ---------------------------------------------------------------------------
 * 主函数
 * ------------------------------------------------------------------------ */

/** 对单个艺打分，返回含逐项明细的可解释结果 */
export function scoreSkill(
  snapshot: SkillSnapshot,
  primaryArt: ArtSlug,
): PriorityBreakdown {
  const factors: PriorityBreakdown['factors'] = [
    {
      key: 'recovery',
      raw: recoveryNeed(snapshot.daysSinceLast),
      weight: WEIGHTS.recovery,
      contribution: 0,
      text: recoveryText(snapshot),
    },
    {
      key: 'completion',
      raw: completionHealth(snapshot.avgCompletion),
      weight: WEIGHTS.completion,
      contribution: 0,
      text: completionText(snapshot),
    },
    {
      key: 'focus',
      raw: planFocus(snapshot, primaryArt),
      weight: WEIGHTS.focus,
      contribution: 0,
      text: focusText(snapshot, primaryArt),
    },
    {
      key: 'fatigue',
      raw: fatigueLoad(snapshot.fatigueNow),
      weight: -WEIGHTS.fatigue,
      contribution: 0,
      text: fatigueText(snapshot),
    },
    {
      key: 'overlap',
      raw: snapshot.overlap48h,
      weight: -WEIGHTS.overlap,
      contribution: 0,
      text: overlapText(snapshot),
    },
    {
      key: 'stall',
      raw: stallFlag(snapshot),
      weight: -WEIGHTS.stall,
      contribution: 0,
      text: stallText(snapshot),
    },
  ];

  let total = 0;
  for (const factor of factors) {
    factor.contribution = factor.raw * factor.weight;
    total += factor.contribution;
  }

  return { total, rank: 0, factors };
}

/** 批量为全部艺打分（`rank` 在排序后回填） */
export function scoreAll(
  snapshots: SkillSnapshot[],
  primaryArt: ArtSlug,
): Record<ArtSlug, PriorityBreakdown> {
  const result = {} as Record<ArtSlug, PriorityBreakdown>;
  for (const snapshot of snapshots) {
    result[snapshot.slug] = scoreSkill(snapshot, primaryArt);
  }
  return result;
}

/**
 * 排序规则：总分降序 → 同分取原书顺序更小者。
 *
 * **完全确定性，无 `Math.random`** —— 同 state + 同 options 必得同结果，可单测、可回放。
 */
export function rankSnapshots(
  snapshots: SkillSnapshot[],
  scores: Record<ArtSlug, PriorityBreakdown>,
): SkillSnapshot[] {
  return [...snapshots].sort(
    (a, b) => scores[b.slug].total - scores[a.slug].total || a.order - b.order,
  );
}
