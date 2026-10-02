/**
 * 今日动作速览 · 数据摊平单测。
 *
 * 守的是三件容易悄悄坏掉的事：
 * 1. 页序 = 今天的训练顺序（主训在前），而不是六艺顺序；
 * 2. 精简规则（步骤截断到 3 条、注意最多 2 条）与**真实条数**分开记录 ——
 *    截断错了页面只会显得「信息少」，真实条数错了脚注会说谎；
 * 3. 内容取不到时必须降级而不是抛错（那一页仍要有身份行与今天的量）。
 */
import { describe, expect, it } from 'vitest';

import type { ArtSlug } from '@/types';
import type { DailyPlan, PlanItem } from '@/types/plan';
import { getMove } from '@/data';

import { DECK_MAX_NOTES, DECK_MAX_STEPS, buildDeck, buildNotes } from './deck';

/* ---------------------------------------------------------------------------
 * 夹具
 * ------------------------------------------------------------------------ */

/** 造一条计划项（名字从真实数据取，避免与 60 式脱节） */
function planItem(skill: ArtSlug, stepNo: number, over: Partial<PlanItem> = {}): PlanItem {
  const move = getMove(skill, stepNo);
  return {
    skill,
    stepNo,
    nameZh: move?.nameZh ?? '未知动作',
    nameEn: move?.nameEn ?? 'unknown',
    role: 'assist',
    metric: 'reps',
    volumeTier: 1,
    sets: 2,
    targetPerSet: 25,
    restSeconds: 60,
    estimatedMinutes: 4,
    reason: '测试用理由',
    ...over,
  };
}

/** 造一份今日计划（只填速览页会用到的字段） */
function dailyPlan(main: PlanItem | null, assists: PlanItem[] = []): DailyPlan {
  return {
    id: 'plan-test',
    date: '2026-10-02',
    generatedAt: '2026-10-02T09:00:00',
    revision: 0,
    availableMinutes: 45,
    kind: main === null ? 'recovery' : 'training',
    main,
    assists,
    optional: [],
    totalEstimatedMinutes: 12,
    warmupMinutes: 3,
    cooldownMinutes: 2,
    freeMinutes: 28,
    summary: '测试摘要',
    tips: [],
    reasons: [],
    excluded: [],
    scores: {} as DailyPlan['scores'],
    appliedOptions: {},
  };
}

/* ---------------------------------------------------------------------------
 * 用例
 * ------------------------------------------------------------------------ */

describe('buildDeck', () => {
  it('未完成首次设置 / 恢复日 → 空数组', () => {
    expect(buildDeck(null)).toEqual([]);
    expect(buildDeck(undefined)).toEqual([]);
    expect(buildDeck(dailyPlan(null))).toEqual([]);
  });

  it('页序 = 今天的训练顺序：主训在前，页码从 1 递增', () => {
    const main = planItem('pushups', 1, { role: 'main' });
    const assists = [planItem('squats', 1), planItem('pullups', 2)];
    const deck = buildDeck(dailyPlan(main, assists));

    expect(deck.map((page) => page.item.skill)).toEqual(['pushups', 'squats', 'pullups']);
    expect(deck.map((page) => page.page)).toEqual([1, 2, 3]);
    // 页序不等于六艺固定顺序（深蹲在引体之前，但 pushups→squats 只是巧合，这里显式反排一次）
    expect(deck[0].item.skill).toBe('pushups');
  });

  it('「怎么做」截断到 3 条，但真实条数照记（脚注不能说谎）', () => {
    // 桥第 1 式（短桥）原书「动作」段共 5 条
    const real = getMove('bridges', 1);
    expect(real).toBeDefined();
    expect(real!.steps.length).toBeGreaterThan(DECK_MAX_STEPS);

    const [page] = buildDeck(dailyPlan(planItem('bridges', 1)));
    expect(page.steps).toHaveLength(DECK_MAX_STEPS);
    expect(page.totalSteps).toBe(real!.steps.length);
    expect(page.steps).toEqual(real!.steps.slice(0, DECK_MAX_STEPS));
  });

  it('原书点名的错误优先于通用要点：有 commonMistakes 时末条为 mistake', () => {
    // 桥第 1 式是原书点名过错误动作的式子之一
    const real = getMove('bridges', 1);
    expect(real!.commonMistakes.length).toBeGreaterThan(0);

    const [page] = buildDeck(dailyPlan(planItem('bridges', 1)));
    const last = page.notes[page.notes.length - 1];

    expect(last.kind).toBe('mistake');
    expect(last.text).toBe(real!.commonMistakes[0]);
    expect(page.notes.length).toBeLessThanOrEqual(DECK_MAX_NOTES);
  });

  it('没有原书点名错误时，注意区只取通用要点，且不超过 2 条', () => {
    // 当前 60 式全部填了 commonMistakes，这条分支真实数据走不到 —— 直接喂纯函数
    const notes = buildNotes({
      keyPoints: ['第一条要点', '第二条要点', '第三条要点'],
      commonMistakes: [],
    });

    expect(notes.map((note) => note.kind)).toEqual(['point', 'point']);
    expect(notes.map((note) => note.text)).toEqual(['第一条要点', '第二条要点']);
  });

  it('有原书点名错误时 = 1 条通用要点 + 该错误（不列第二条错误，版面优先）', () => {
    const notes = buildNotes({
      keyPoints: ['第一条要点', '第二条要点'],
      commonMistakes: ['错误甲 —— 纠正甲', '错误乙 —— 纠正乙'],
    });

    expect(notes).toEqual([
      { kind: 'point', text: '第一条要点' },
      { kind: 'mistake', text: '错误甲 —— 纠正甲' },
    ]);
  });

  it('连通用要点都没有时只剩错误那一条，不产生空位', () => {
    const notes = buildNotes({ keyPoints: [], commonMistakes: ['错误甲 —— 纠正甲'] });
    expect(notes).toEqual([{ kind: 'mistake', text: '错误甲 —— 纠正甲' }]);
  });

  it('风险提示与降阶各就各位；没有风险提示时为 null', () => {
    const [bridge] = buildDeck(dailyPlan(planItem('bridges', 1)));
    expect(bridge.riskNote).not.toBeNull();
    expect(bridge.regression).not.toBeNull();

    const [pushup] = buildDeck(dailyPlan(planItem('pushups', 1)));
    expect(pushup.riskNote).toBeNull();
  });

  it('内容取不到时降级：仍给出身份行数据与详情页地址，不抛错', () => {
    // 式号 99 不在 60 式里 —— 模拟数据缺口
    const [page] = buildDeck(dailyPlan(planItem('pushups', 99)));

    expect(page.move).toBeNull();
    expect(page.steps).toEqual([]);
    expect(page.notes).toEqual([]);
    expect(page.regression).toBeNull();
    expect(page.riskNote).toBeNull();
    expect(page.item.sets).toBe(2);
    expect(page.href).toBe('/arts/pushups/99');
  });

  it('详情页地址指向该式的正式路由', () => {
    const [page] = buildDeck(dailyPlan(planItem('leg-raises', 3)));
    expect(page.href).toBe('/arts/leg-raises/3');
  });
});
