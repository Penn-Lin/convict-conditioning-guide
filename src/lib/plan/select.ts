/**
 * 主训练与辅助训练的选择规则（设计文档 §7）。
 *
 * **主训用「优先级」，辅助用「互补性」—— 双标准，不是摆设。**
 *
 * 举一个真实例子（§10.5）：桥的优先级（0.6042）比举腿（0.5875）**高**，
 * 但作为辅助排在举腿之后 —— 因为辅助分里互补性占 0.3 权重，桥与主训深蹲的重叠 0.40 拖累了它。
 */
import type { ArtSlug } from '@/types';
import type { PriorityBreakdown, SkillSnapshot } from '@/types/plan';

import { ASSIST_WEIGHTS, OVERLAP, OVERLAP_MATRIX } from './config';

/** 一个辅助候选的评分明细 */
export interface AssistCandidate {
  snapshot: SkillSnapshot;
  /** 辅助分（三个成分加权） */
  value: number;
  /** 三个成分的拆解，供 UI 展开「为什么它被选为辅助」 */
  parts: { score: number; complement: number; freshness: number };
  /** 与主训的负荷重叠 */
  overlapWithMain: number;
}

/**
 * 算辅助分（§7.2 第一步）。
 *
 * ```
 * assistScore(s) =
 *       W.score      × priority(s)              // 0.50  本身就该练
 *     + W.complement × (1 − MATRIX[main][s])    // 0.30  与主训互补
 *     − W.freshness  × overlap48h(s)            // 0.20  48h 内练过的负荷别再叠加
 * ```
 */
export function scoreAssists(
  main: ArtSlug,
  candidates: SkillSnapshot[],
  scores: Record<ArtSlug, PriorityBreakdown>,
): AssistCandidate[] {
  return candidates
    .filter((snapshot) => snapshot.slug !== main)
    .map((snapshot) => {
      const priority = scores[snapshot.slug].total;
      const complement = 1 - OVERLAP_MATRIX[main][snapshot.slug];
      const freshness = snapshot.overlap48h;
      const parts = {
        score: ASSIST_WEIGHTS.score * priority,
        complement: ASSIST_WEIGHTS.complement * complement,
        freshness: -ASSIST_WEIGHTS.freshness * freshness,
      };
      return {
        snapshot,
        value: parts.score + parts.complement + parts.freshness,
        parts,
        overlapWithMain: OVERLAP_MATRIX[main][snapshot.slug],
      };
    });
}

/**
 * 选出辅助训练（§7.2 第二步 + 第三步）。
 *
 * 从高到低遍历辅助分，不满足硬约束就跳过取下一个：
 * 1. 与主训的重叠 ≤ `maxWithMain`(0.60) —— 禁止「俯卧撑 + 倒立撑」这类双推组合；
 * 2. 与已入选辅助的两两重叠 ≤ `maxBetweenAssists`(0.60) —— 防止三个辅助互相重叠；
 * 3. 不与主训同艺。
 */
export function selectAssists(
  candidates: AssistCandidate[],
  count: number,
): AssistCandidate[] {
  if (count <= 0) return [];

  const ordered = [...candidates].sort(
    (a, b) => b.value - a.value || a.snapshot.order - b.snapshot.order,
  );

  const picked: AssistCandidate[] = [];
  for (const candidate of ordered) {
    if (picked.length >= count) break;
    if (candidate.overlapWithMain > OVERLAP.maxWithMain) continue;
    const conflicts = picked.some(
      (chosen) =>
        OVERLAP_MATRIX[chosen.snapshot.slug][candidate.snapshot.slug] >
        OVERLAP.maxBetweenAssists,
    );
    if (conflicts) continue;
    picked.push(candidate);
  }

  return picked;
}

/**
 * 训练顺序（§7.7）：主训在前（体力最好时做最难的动作），
 * 辅助按**辅助分降序**排列 —— 辅助分本身已含互补性权重，越互补自然越靠前。
 */
export function orderForDisplay(
  main: SkillSnapshot | null,
  assists: AssistCandidate[],
): {
  role: 'main' | 'assist';
  snapshot: SkillSnapshot;
  candidate?: AssistCandidate;
}[] {
  const list: {
    role: 'main' | 'assist';
    snapshot: SkillSnapshot;
    candidate?: AssistCandidate;
  }[] = [];
  if (main) list.push({ role: 'main', snapshot: main });
  for (const candidate of assists) {
    list.push({ role: 'assist', snapshot: candidate.snapshot, candidate });
  }
  return list;
}
