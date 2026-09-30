/**
 * 原书训练计划模板的科目解析（v4 新增）。
 *
 * ## 这一层只干一件事
 * 决定**今天练哪几门**。它取代 `gate.ts`（硬门控排除）+ 优先级打分里的「选谁」部分，
 * 但**完全不碰**训练量档、组数、单组次数、组间休息、时间账、记录与晋级 ——
 * 那些逻辑与「科目怎么选出来」无关，两种模式共用同一份实现。
 *
 * ## 为什么不绑定星期几
 * 原书「渐入佳境」写的是「一周训练 3 次」，但它真正的约束是**恢复间隔**，不是日历。
 * 本站把它落成一条与日期无关的规则：
 *
 * ```
 * 今天到期的科目 = 距上次训练 ≥ TEXTBOOK_REST_DAYS(2) 天的艺（从未练过的一律到期）
 * ```
 *
 * 推演：隔天练 → 六门全部到期 → 每次都是六艺全练；
 * 中间空了两天甚至三天 → 依然全部到期 → 照样六艺全练（既不补也不欠）；
 * 一周出现第 4 次训练 → 隔天节奏本身就是 3.5 次/周（4 次周与 3 次周交替），属正常。
 *
 * 这样「一周练几次」就不再需要任何特殊处理，用户按自己的节奏走即可。
 */
import type { ArtSlug } from '@/types';
import type { ScheduleMode, SkillSnapshot } from '@/types/plan';

import {
  TEXTBOOK_PLANS,
  TEXTBOOK_REST_DAYS,
  isTextbookMode,
  type TextbookPlan,
  type TextbookSlug,
} from './config';

/** 科目解析结果 */
export interface TemplateSelection {
  /** 今天要练的科目（按模板顺序） */
  arts: ArtSlug[];
  /** 距上次训练不足 `TEXTBOOK_REST_DAYS` 天而被判定「未到期」的科目 */
  resting: ArtSlug[];
  /**
   * 是否走了「全部未到期」的兜底路径。
   *
   * 触发条件：**昨天刚练完全部科目**（连续两天训练）。此时到期集合为空，
   * 但用户既然打开了训练页就是想练，所以照排全部科目、**强制降到最低档**并明确说明。
   * 依据原书：「如果你觉得并无大碍还可以训练，那就练些低难度的动作（根据具体情况自己判断）。」
   */
  allResting: boolean;
}

/** 某门艺今天是否「到期」（距上次训练够久，或从未练过） */
export function isDue(snapshot: SkillSnapshot): boolean {
  if (snapshot.daysSinceLast === null) return true;
  return snapshot.daysSinceLast >= TEXTBOOK_REST_DAYS;
}

/**
 * 解析模板模式下的今日科目。
 *
 * @param mode      模板标识（不含 `auto`）
 * @param snapshots 六艺计算态（`buildSnapshots` 的输出）
 * @param excluded  用户当天主动排除的艺（作用于模板清单之上；排除后仍保留「不返回空计划」的兜底）
 */
export function resolveTemplate(
  mode: TextbookSlug,
  snapshots: SkillSnapshot[],
  excluded: readonly ArtSlug[] = [],
): TemplateSelection {
  const plan = TEXTBOOK_PLANS[mode];
  const bySlug = new Map(snapshots.map((snapshot) => [snapshot.slug, snapshot]));
  const excludeSet = new Set(excluded);

  const due: ArtSlug[] = [];
  const resting: ArtSlug[] = [];

  for (const slug of plan.arts) {
    if (excludeSet.has(slug)) continue;
    const snapshot = bySlug.get(slug);
    // 快照缺失（理论上不会）按「未到期」处理，避免把不存在的艺排进计划
    if (!snapshot) continue;
    if (isDue(snapshot)) due.push(slug);
    else resting.push(slug);
  }

  // 全部未到期（或全被排除）→ 兜底：不返回空计划，改成「全排 + 降档」，
  // 由调用方强制最低档。被用户排除的艺**不会**因为这个兜底又被塞回来。
  if (due.length === 0) {
    const fallback = plan.arts.filter((slug) => !excludeSet.has(slug));
    if (fallback.length === 0) return { arts: [], resting, allResting: false };
    return { arts: [...fallback], resting, allResting: true };
  }

  return { arts: due, resting, allResting: false };
}

/** 取模板定义（UI 显示用；`auto` 返回 `null`） */
export function textbookPlanOf(mode: ScheduleMode): TextbookPlan | null {
  return isTextbookMode(mode) ? TEXTBOOK_PLANS[mode] : null;
}

export { isTextbookMode, TEXTBOOK_PLANS, TEXTBOOK_REST_DAYS };
export type { TextbookPlan, TextbookSlug };
