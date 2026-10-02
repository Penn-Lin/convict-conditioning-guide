/**
 * 今日动作速览 · 数据摊平（纯函数）。
 *
 * 把引擎产出的 `DailyPlan` 摊成「一页一个动作」的页数组，并把**精简规则**
 * （截断条数、原书点名的错误优先）收在这里 —— 页面只管渲染。
 *
 * 为什么不把这些规则写进 JSX：
 * - 「前 3 条步骤」「原书点名的错误优先于通用要点」是**内容决策**，
 *   散在页面里就没人测得出来（改错了也只会觉得「今天这页有点长」）；
 * - 页面需要 `move` 取不到时的降级路径，集中在一处才容易保证「不白屏」。
 *
 * ⚠️ 本文件**不新增任何文案**，只做裁剪与挑选。文案全部来自既有字段，
 * 这是站内的硬约定（见 `MEMORY.md` §1.7：`steps` / `keyPoints` / `regression`
 * 一律不得推导，`commonMistakes` 只采用原书点名过的那几条）。
 */
import type { ResolvedMove } from '@/types';
import type { DailyPlan, PlanItem } from '@/types/plan';
import { getMove } from '@/data';
import { moveHref } from '@/lib/slug';

/** 每页展示的「怎么做」条数上限（超出的部分靠脚注指向详情页） */
export const DECK_MAX_STEPS = 3;

/** 每页展示的「注意」条数上限 */
export const DECK_MAX_NOTES = 2;

/** 注意区的一条：通用要点 / 原书点名的错误 */
export interface DeckNote {
  kind: 'point' | 'mistake';
  text: string;
}

/** 速览页的一页 = 今天计划里的一项 */
export interface DeckItem {
  /** 页码（1 起），与今天的训练顺序一致 */
  page: number;
  /** 今天的计划项（量、角色、休息都由它来） */
  item: PlanItem;
  /** 该式的完整内容；数据缺失时为 `null`（页面降级渲染，不抛错） */
  move: ResolvedMove | null;
  /** 「怎么做」：`steps` 的前 N 条 */
  steps: string[];
  /** `steps` 的真实条数（用于「共 N 步」脚注） */
  totalSteps: number;
  /** 「注意」：最多 2 条 */
  notes: DeckNote[];
  /** 降阶原文（页面里折叠展示） */
  regression: string | null;
  /** 风险提示（页面里常驻展示，不折叠） */
  riskNote: string | null;
  /** 详情页地址 */
  href: string;
}

/** 今天的计划项（主训在前，恢复日为 0 项） */
function planItems(plan: DailyPlan): PlanItem[] {
  return [plan.main, ...plan.assists].filter(
    (item): item is PlanItem => item !== null,
  );
}

/**
 * 注意区取哪几条。
 *
 * 优先级刻意是「原书点名的错误 > 通用要点」：前者是用户真的会踩的坑，
 * 后者读起来更像原则。原书有点名错误时只留一条通用要点，避免整屏都是字。
 *
 * 导出的理由：当前 60 式全部填了 `commonMistakes`，「空数组」这条分支在真实数据里
 * 走不到 —— 只有直接对它做纯函数单测才守得住（数据一变就会有人发现）。
 */
export function buildNotes(
  move: Pick<ResolvedMove, 'keyPoints' | 'commonMistakes'>,
): DeckNote[] {
  const mistake = move.commonMistakes[0];
  if (mistake !== undefined) {
    const point = move.keyPoints[0];
    return [
      ...(point === undefined ? [] : [{ kind: 'point' as const, text: point }]),
      { kind: 'mistake' as const, text: mistake },
    ];
  }
  return move.keyPoints
    .slice(0, DECK_MAX_NOTES)
    .map((text) => ({ kind: 'point' as const, text }));
}

/** 单项 → 一页 */
function toDeckItem(item: PlanItem, page: number): DeckItem {
  const move = getMove(item.skill, item.stepNo);
  const href = moveHref(item.skill, item.stepNo);

  // 降级路径：内容取不到时仍保留身份行与今天的量 —— 那一页不能是空白
  if (move === undefined) {
    return {
      page,
      item,
      move: null,
      steps: [],
      totalSteps: 0,
      notes: [],
      regression: null,
      riskNote: null,
      href,
    };
  }

  return {
    page,
    item,
    move,
    steps: move.steps.slice(0, DECK_MAX_STEPS),
    totalSteps: move.steps.length,
    notes: buildNotes(move),
    regression: move.regression.trim() === '' ? null : move.regression,
    riskNote: move.riskNote?.trim() ? move.riskNote : null,
    href,
  };
}

/**
 * 摊平今日计划为速览页数组。
 *
 * @param plan 今日计划（未完成首次设置时为 `null`）
 * @returns 顺序 = 今天的训练顺序（主训在前）；恢复日或空计划返回 `[]`
 *
 * @example
 * buildDeck(plan).length  // 4
 * buildDeck(null)         // []
 */
export function buildDeck(plan: DailyPlan | null | undefined): DeckItem[] {
  if (!plan) return [];
  return planItems(plan).map((item, index) => toDeckItem(item, index + 1));
}
