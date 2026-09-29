/**
 * 硬门控（设计文档 §4.2）。
 *
 * 顺序：先按 7 条硬规则过滤，**过滤后候选池不足 `GATE.minPool` 则按排除优先级逐条放回**。
 *
 * 关键设计：**宁可安排一个不理想的训练，也不要给用户一个空白页。**
 * 被放回的项目必须写进解释（`SOFT_RETURN`），文案明说「按规则本应排除，因候选不足已放回，
 * 建议降低训练量」。**透明度优先于完美。**
 *
 * 注意：门控只排除「明显不该练」的极端情况。像「昨天练过」这种常规情况**不在此处排除**，
 * 而是通过优先级打分体现 —— 否则就变成了一刀切。
 */
import type { ArtSlug } from '@/types';
import type {
  ExclusionCode,
  ExclusionRecord,
  PlanOptions,
  SkillSnapshot,
  TrainingSkill,
} from '@/types/plan';

import { GATE, LOAD_TYPE_LABEL, OVERLAP } from './config';

/** 门控结果 */
export interface GateResult {
  /** 可参与打分的候选池 */
  pool: SkillSnapshot[];
  /** 被排除的项目（含原因，供 UI 的「今天没有安排」区块展示） */
  excluded: ExclusionRecord[];
  /** 因候选不足被放回的项目（需在解释中额外说明） */
  returned: { skill: ArtSlug; code: ExclusionCode; text: string }[];
}

/** 单条排除原因文案 */
function exclusionText(
  snapshot: SkillSnapshot,
  code: ExclusionCode,
  fromOptions: boolean,
): string {
  switch (code) {
    case 'MASTERED':
      return '十式已全部完成，不再需要安排训练。';
    case 'USER_EXCLUDE':
      return fromOptions
        ? '已按你的要求，今天不练这个项目。'
        : '你已在设置中长期关闭了这个项目。';
    case 'USER_ONLY':
      return '今天只想练你指定的项目，它不在其中。';
    case 'TRAINED_TODAY': {
      const hours = snapshot.hoursSinceLast ?? 0;
      const shown = hours >= 1 ? `${hours.toFixed(0)} 小时前` : '刚刚';
      return `${shown}刚练过（不足 ${GATE.trainedTodayHours} 小时），今天不再叠加同一个项目。`;
    }
    case 'HIGH_FATIGUE':
      return `上次训练自觉很累（${snapshot.fatigueNow.toFixed(1)}/5），且间隔不足 ${OVERLAP.lookbackHours} 小时，需要更多恢复。`;
    case 'STALLED':
      return `连续多次未完成，正处于恢复期（${GATE.stallRestHours} 小时内不安排为主训）。`;
    case 'LOW_PRIORITY':
      return '今天优先级排在后面，未被选中。';
    default:
      return '';
  }
}

/** 判定单个艺的排除代码；不排除时返回 `null` */
function exclusionCodeOf(
  snapshot: SkillSnapshot,
  skill: TrainingSkill,
  options: PlanOptions,
): { code: ExclusionCode; fromOptions: boolean } | null {
  const excludes = options.excludeSkills ?? [];
  const only = options.onlySkills ?? [];

  if (snapshot.status === 'mastered') return { code: 'MASTERED', fromOptions: false };
  if (skill.excluded) return { code: 'USER_EXCLUDE', fromOptions: false };
  if (excludes.includes(snapshot.slug)) {
    return { code: 'USER_EXCLUDE', fromOptions: true };
  }
  if (only.length > 0 && !only.includes(snapshot.slug)) {
    return { code: 'USER_ONLY', fromOptions: true };
  }

  const hours = snapshot.hoursSinceLast;
  if (hours !== null && hours < GATE.trainedTodayHours) {
    return { code: 'TRAINED_TODAY', fromOptions: false };
  }
  if (
    snapshot.fatigueNow >= GATE.highFatigueScore &&
    hours !== null &&
    hours <= OVERLAP.lookbackHours
  ) {
    return { code: 'HIGH_FATIGUE', fromOptions: false };
  }
  if (
    snapshot.status === 'stalled' &&
    hours !== null &&
    hours <= GATE.stallRestHours
  ) {
    return { code: 'STALLED', fromOptions: false };
  }

  return null;
}

/** 放回顺序的排序权重（越小越先放回） */
function returnRank(code: ExclusionCode): number {
  const index = (GATE.returnOrder as readonly string[]).indexOf(code);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/**
 * 套用硬门控。
 *
 * @param snapshots 六艺快照
 * @param skills    存储态（读 `excluded` 长期开关）
 * @param options   用户当天调整
 */
export function applyGate(
  snapshots: SkillSnapshot[],
  skills: Record<ArtSlug, TrainingSkill>,
  options: PlanOptions,
): GateResult {
  const pool: SkillSnapshot[] = [];
  const excluded: ExclusionRecord[] = [];

  for (const snapshot of snapshots) {
    const verdict = exclusionCodeOf(snapshot, skills[snapshot.slug], options);
    if (verdict === null) {
      pool.push(snapshot);
      continue;
    }
    excluded.push({
      skill: snapshot.slug,
      code: verdict.code,
      text: exclusionText(snapshot, verdict.code, verdict.fromOptions),
    });
  }

  // 软放回：候选不足时，按「最可以忍」的顺序逐条放回，直到池子够用。
  const returned: GateResult['returned'] = [];
  if (pool.length > 0 && pool.length < GATE.minPool) {
    const candidates = [...excluded].sort(
      (a, b) => returnRank(a.code) - returnRank(b.code),
    );
    for (const record of candidates) {
      if (pool.length >= GATE.minPool) break;
      const snapshot = snapshots.find((item) => item.slug === record.skill);
      if (!snapshot) continue;

      pool.push(snapshot);
      returned.push({
        skill: record.skill,
        code: record.code,
        text: `「${LOAD_TYPE_LABEL[record.skill]}」按规则本应排除（${record.text}），但今天可选项目不足 ${GATE.minPool} 个，已放回候选。建议降低训练量、延长组间休息。`,
      });
      excluded.splice(excluded.indexOf(record), 1);
    }
  }

  // 池内重新按原书顺序排列（排序在打分阶段另行处理）
  pool.sort((a, b) => a.order - b.order);

  return { pool, excluded, returned };
}
