/**
 * 解释文案生成（设计文档 §5.5 / §10.7）。
 *
 * **核心要求：解释必须由真实计算结果动态生成，而不是写死。**
 *
 * 每一句都由 `PlanReason.values` 里的真实数值填充（`daysSince`、`avgCompletion`、
 * `matrix`、`fatigue`…），换一组数据就换一句话。UI 侧只负责按 `code` 选样式
 * （红 / 绿 / 灰），文案由引擎给全。
 */
import type { ArtSlug } from '@/types';
import type {
  ExclusionRecord,
  PlanItem,
  PlanOptions,
  PlanReason,
  PriorityBreakdown,
  SkillSnapshot,
} from '@/types/plan';
import { getArt } from '@/data';

import {
  COMPLETION,
  FATIGUE,
  LOAD_TYPE_LABEL,
  OVERLAP_MATRIX,
  RECOVERY,
} from './config';
import type { AssistCandidate } from './select';
import { formatVolume } from './volumeLadder';

/** 艺的中文名（数据层真源，缺失时退回负荷类型标签） */
function artName(slug: ArtSlug): string {
  return getArt(slug)?.nameZh ?? LOAD_TYPE_LABEL[slug];
}

/** 恢复短语：「尚未开始训练」/「已经 7 天没有训练，恢复充分」 */
function recoveryPhrase(snapshot: SkillSnapshot): string {
  if (snapshot.daysSinceLast === null) return '尚未开始训练';
  if (snapshot.daysSinceLast >= RECOVERY.fullDays) {
    return `已经 ${snapshot.daysSinceLast} 天没有训练，恢复充分`;
  }
  return `已经 ${snapshot.daysSinceLast} 天没有训练`;
}

/** 完成度短语 */
function completionPhrase(snapshot: SkillSnapshot): string {
  const percent = Math.round(snapshot.avgCompletion * 100);
  if (snapshot.avgCompletion >= 0.95) return `最近完成度稳定（${percent}%）`;
  if (snapshot.avgCompletion < COMPLETION.noHistoryDefault) {
    return `最近完成度偏低（${percent}%）`;
  }
  return `最近完成度正常（${percent}%）`;
}

/** 主训练理由 */
export function mainReason(snapshot: SkillSnapshot): string {
  const name = artName(snapshot.slug);
  if (snapshot.daysSinceLast === null) {
    return `${name}尚未开始训练，本次作为今天的主要训练，按初级标准起步。`;
  }
  return `${name}${recoveryPhrase(snapshot)}；${completionPhrase(snapshot)}，因此作为今天的主要训练。`;
}

/** 辅助训练理由 */
export function assistReason(
  candidate: AssistCandidate,
  mainSlug: ArtSlug,
  _mainStepNo: number,
): string {
  const { snapshot, overlapWithMain } = candidate;
  const overlapPercent = Math.round(overlapWithMain * 100);
  const mainName = artName(mainSlug);
  const name = artName(snapshot.slug);

  if (snapshot.daysSinceLast === null) {
    const tier =
      snapshot.ladder[Math.min(snapshot.volumeTier, snapshot.ladder.length - 1)];
    const volume = formatVolume(snapshot.metric, tier.sets, tier.perSet);
    return `${name}尚未开始训练，首次安排 ${volume}（初级标准）；与主训练（${mainName}）负荷重叠 ${overlapPercent}%，可以承受。`;
  }

  return `${name}${recoveryPhrase(snapshot)}，${completionPhrase(snapshot)}；与主训练（${mainName}）负荷重叠 ${overlapPercent}%，互补良好，作为辅助训练。`;
}

/* ---------------------------------------------------------------------------
 * 「今天没有安排」的低优先级解释
 * ------------------------------------------------------------------------ */

/**
 * 为「候选池内但未被选中」的项目生成解释 ——
 * 挑出扣分最多的两项因子，用真实数值说清楚「为什么今天没排它」。
 */
export function lowPriorityReason(
  snapshot: SkillSnapshot,
  scores: Record<ArtSlug, PriorityBreakdown>,
): string {
  const breakdown = scores[snapshot.slug];
  const negatives = breakdown.factors
    .filter((factor) => factor.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution);

  const causes: string[] = [];

  for (const factor of negatives) {
    if (causes.length >= 2) break;
    if (factor.key === 'overlap') {
      const sources = snapshot.recentSkills
        .map((slug) => ({ slug, value: OVERLAP_MATRIX[slug][snapshot.slug] }))
        .sort((a, b) => b.value - a.value);
      const top = sources[0];
      const percent = Math.round(snapshot.overlap48h * 100);
      const typeSelf = LOAD_TYPE_LABEL[snapshot.slug];
      if (top && top.slug === snapshot.slug) {
        causes.push(`昨天刚完成训练（同一项目负荷重叠 ${percent}%），恢复不足`);
      } else if (top) {
        causes.push(
          `最近 48 小时内练过${LOAD_TYPE_LABEL[top.slug]}，与它的${typeSelf}负荷重叠 ${percent}%，今天暂不叠加`,
        );
      }
    } else if (factor.key === 'fatigue') {
      causes.push(`上次训练自觉很累（${snapshot.fatigueNow.toFixed(1)}/5）`);
    } else if (factor.key === 'stall') {
      causes.push('连续多次未完成，需要休息');
    }
  }

  if (causes.length === 0) {
    const rank = breakdown.rank;
    causes.push(`今天优先级排在第 ${rank} 位，未被选中`);
  }

  return `${causes.join('，且')}，今天降低优先级。`;
}

/* ---------------------------------------------------------------------------
 * 计划级解释
 * ------------------------------------------------------------------------ */

/** 解释生成的输入 */
export interface ExplainInput {
  main: { snapshot: SkillSnapshot; item: PlanItem } | null;
  assists: { candidate: AssistCandidate; item: PlanItem }[];
  unselected: SkillSnapshot[];
  scores: Record<ArtSlug, PriorityBreakdown>;
  excluded: ExclusionRecord[];
  options: PlanOptions;
  minutes: number;
  totalEstimatedMinutes: number;
  /** 时间档基础项数 / 周缺口加成 / 疲劳抑制 */
  countDecision: {
    base: number;
    weekBonus: number;
    fatigueReduce: number;
    total: number;
    avgFatigue: number;
    weekNote: string | null;
  };
  returned: { skill: ArtSlug; code: string; text: string }[];
  kind: 'training' | 'recovery';
  /** 今日训练量档的说明（时间档抬高档位 / 用户手动指定时非 null） */
  tierNote?: string | null;
}

/** 生成完整的 `PlanReason[]`（UI 直接渲染，无需自己拼文案） */
export function buildReasons(input: ExplainInput): PlanReason[] {
  const reasons: PlanReason[] = [];
  const {
    main,
    assists,
    unselected,
    scores,
    excluded,
    options,
    minutes,
    countDecision,
    returned,
    kind,
    tierNote,
  } = input;

  // ① 用户调整（优先展示，让用户知道「因为你的调整，计划变成了这样」）
  const excludes = options.excludeSkills ?? [];
  const only = options.onlySkills ?? [];
  for (const slug of excludes) {
    reasons.push({
      skill: slug,
      code: 'USER_EXCLUDE',
      text: `已按你的要求，今天不安排${LOAD_TYPE_LABEL[slug]}；其余项目已按同一套规则重新计算。`,
      values: { skill: slug },
    });
  }
  if (only.length > 0) {
    reasons.push({
      code: 'USER_ONLY',
      text: `今天只在你指定的 ${only.map((slug) => LOAD_TYPE_LABEL[slug]).join('、')} 中挑选，其余项目已排除。`,
      values: { only: only.join(',') },
    });
  }
  const delta = options.setsDelta ?? 0;
  if (delta !== 0) {
    reasons.push({
      code: 'SETS_DELTA',
      text:
        delta > 0
          ? `已按你的要求增加训练量：每一项在今天的档位基础上各加 1 组，单组次数不变（仍由训练量阶梯决定）。单次最多 4 组。`
          : `已按你的要求减少训练量：每一项在今天的档位基础上各减 1 组，最少保留 1 组；单组次数不变。`,
      values: { setsDelta: delta },
    });
  }

  // ①b 今日训练量档（时间档抬档 / 用户手动指定）—— 必须显式说明，否则会被当成偷偷加量
  if (tierNote) {
    reasons.push({
      code: 'TIER_FLOOR',
      text: tierNote,
      values: { tier: options.volumeTierOverride ?? -1 },
    });
  }

  // ② 恢复日兜底
  if (kind === 'recovery') {
    reasons.push({
      code: 'RECOVERY_DAY',
      text: '今天已无合适的训练项目，建议安排恢复：散步、拉伸、呼吸练习，或提早休息。',
      values: { excludedCount: excluded.length },
    });
    return reasons;
  }

  // ③ 主训练
  if (main) {
    const snapshot = main.snapshot;
    const code =
      snapshot.daysSinceLast === null
        ? 'NEVER_TRAINED'
        : snapshot.daysSinceLast >= RECOVERY.fullDays
          ? 'RECOVERY_FULL'
          : 'RECOVERY_MODERATE';
    reasons.push({
      skill: snapshot.slug,
      code,
      text: main.item.reason,
      values: {
        daysSince: snapshot.daysSinceLast ?? -1,
        avgCompletion: Math.round(snapshot.avgCompletion * 100) / 100,
        score: Math.round(scores[snapshot.slug].total * 10000) / 10000,
      },
    });

    if (snapshot.progressionReady && snapshot.progressionHint) {
      reasons.push({
        skill: snapshot.slug,
        code: 'PROGRESSION_READY',
        text: snapshot.progressionHint,
        values: { stepNo: snapshot.currentStep, tier: snapshot.volumeTier },
      });
    }
  }

  // ④ 辅助训练
  for (const { candidate, item } of assists) {
    reasons.push({
      skill: candidate.snapshot.slug,
      code: 'COMPLEMENT_MAIN',
      text: item.reason,
      values: {
        matrix: candidate.overlapWithMain,
        assistScore: Math.round(candidate.value * 10000) / 10000,
        daysSince: candidate.snapshot.daysSinceLast ?? -1,
      },
    });
  }

  // ⑤ 时间与项数
  const countBits: string[] = [`时间限制为 ${minutes} 分钟`];
  if (countDecision.fatigueReduce > 0) {
    countBits.push(
      `六艺整体疲劳偏高（均值 ${countDecision.avgFatigue.toFixed(1)}/5），已少排 ${countDecision.fatigueReduce} 项`,
    );
  }
  reasons.push({
    code: 'TIME_BUDGET',
    text: `${countBits.join('，')}，已安排 1 个主训练 + ${assists.length} 个辅助训练，共 ${countDecision.total} 项。`,
    values: {
      minutes,
      base: countDecision.base,
      total: countDecision.total,
      avgFatigue: Math.round(countDecision.avgFatigue * 100) / 100,
    },
  });

  if (countDecision.weekBonus > 0 && countDecision.weekNote) {
    reasons.push({
      code: 'WEEK_DEFICIT',
      text: countDecision.weekNote,
      values: { bonus: countDecision.weekBonus },
    });
  }

  // ⑥ 软放回（透明度优先：按规则本应排除，因候选不足已放回）
  for (const record of returned) {
    reasons.push({
      skill: record.skill,
      code: 'SOFT_RETURN',
      text: record.text,
      values: { code: record.code },
    });
  }

  // ⑦ 未选中项目（含硬排除与低优先级）
  for (const record of excluded) {
    reasons.push({
      skill: record.skill,
      code: 'OVERLAP_RECENT',
      text: record.text,
      values: { code: record.code },
    });
  }
  for (const snapshot of unselected) {
    reasons.push({
      skill: snapshot.slug,
      code: 'OVERLAP_RECENT',
      text: lowPriorityReason(snapshot, scores),
      values: {
        score: Math.round(scores[snapshot.slug].total * 10000) / 10000,
        rank: scores[snapshot.slug].rank,
      },
    });
  }

  return reasons;
}

/** 时间账（热身 / 训练 / 放松 / 富余）—— 与 `index.timeLedger` 同构 */
export interface TimeLedger {
  warmupMinutes: number;
  cooldownMinutes: number;
  freeMinutes: number;
}

/**
 * 生成一句话摘要（首页 / 计划页首屏）。
 *
 * 摘要必须给出**含热身的完整时间账**，而不是只报训练动作的净耗时 ——
 * 否则「选了 60 分钟」与「预计 8 分钟」之间的落差会显得像算错了。
 */
export function buildSummary(
  kind: 'training' | 'recovery',
  mainItem: PlanItem | null,
  assists: PlanItem[],
  totalMinutes: number,
  minutes: number,
  ledger: TimeLedger,
): string {
  if (kind === 'recovery' || !mainItem) {
    return '今天建议安排恢复：散步、拉伸或呼吸练习。';
  }
  const assistText =
    assists.length > 0
      ? `，再补 ${assists.map((item) => item.nameZh).join('、')}`
      : '';
  const total = Math.round((ledger.warmupMinutes + totalMinutes + ledger.cooldownMinutes) * 10) / 10;
  const freeText =
    ledger.freeMinutes >= 5
      ? `，你的时间档是 ${minutes} 分钟，还剩约 ${ledger.freeMinutes} 分钟`
      : '';
  return `今天主练${mainItem.nameZh}${assistText}，训练 ${totalMinutes} 分钟（含热身与放松约 ${total} 分钟）${freeText}。`;
}

/**
 * 训练提示。
 *
 * 三条硬规则（都是被用户投诉过的地方）：
 * 1. **不许再说「剩余 X 分钟建议用于热身」** —— 热身是固定的 2 组、约 3 分钟，
 *    原书明确说「超过 4 组只是白费力气」，不可能吃掉半小时。
 * 2. **组间休息必须说明是参考值** —— 原书原文「这没有什么规定，完全要看你的个人情况」，
 *    把它写成硬性指标是在编造原书没有的话。
 * 3. 有富余时间时，明确「不填满是对的」并指向加练自选，而不是让人以为漏排了动作。
 */
export function buildTips(
  items: PlanItem[],
  minutes: number,
  totalMinutes: number,
  ledger: TimeLedger,
): string[] {
  const tips: string[] = ['不练到力竭，每式达标即止。'];

  const mainItem = items.find((item) => item.role === 'main');
  const assistRest = items.find((item) => item.role === 'assist')?.restSeconds;
  if (mainItem) {
    tips.push(
      assistRest && assistRest !== mainItem.restSeconds
        ? `${mainItem.nameZh}组间休息参考 ${mainItem.restSeconds} 秒，其余 ${assistRest} 秒；没恢复就继续休息，原书不设上限。`
        : `组间休息参考 ${mainItem.restSeconds} 秒；没恢复就继续休息，原书不设上限。`,
    );
  }

  const work = Math.round((ledger.warmupMinutes + totalMinutes + ledger.cooldownMinutes) * 10) / 10;
  tips.push(
    `时间账：热身约 ${ledger.warmupMinutes} 分钟（用低难度版本做两组）+ 训练 ${totalMinutes} 分钟 + 放松约 ${ledger.cooldownMinutes} 分钟 ≈ ${work} 分钟，你的时间档是 ${minutes} 分钟。`,
  );

  if (ledger.freeMinutes >= 10) {
    tips.push(
      `还剩约 ${ledger.freeMinutes} 分钟。原书主张「质高于量」：不练到力竭、不拉长训练，` +
        `富余时间用于走动放松即可。想多练就从下面的「加练自选」里挑 1–2 项，而不是把现有项目加组。`,
    );
  }

  tips.push('任一动作出现尖锐疼痛立即停止，不要带痛训练。');
  return tips;
}

/** 疲劳中性值的再导出（避免 UI 侧重复硬编码 3） */
export const NEUTRAL_FATIGUE = FATIGUE.neutral;
