#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
动态训练计划系统 · 设计文档（docs/DYNAMIC-PLAN-DESIGN.md）§10 数值复现脚本。

用途：验证文档 §10 中所有打分 / 选项目 / 耗时估算数字。
实施阶段可直接把本脚本的输入数据与期望输出搬成单元测试夹具（§12.1 的 __tests__）。

运行：
    python docs/design/verify-plan-demo.py
"""

# ---------------------------------------------------------------- 配置（§11）
MATRIX = {
    'pushups':   {'pushups': 1.00, 'handstand': 0.60, 'pullups': 0.10, 'squats': 0.10, 'legraises': 0.10, 'bridges': 0.20},
    'handstand': {'pushups': 0.60, 'handstand': 1.00, 'pullups': 0.20, 'squats': 0.10, 'legraises': 0.20, 'bridges': 0.30},
    'pullups':   {'pushups': 0.10, 'handstand': 0.20, 'pullups': 1.00, 'squats': 0.20, 'legraises': 0.30, 'bridges': 0.35},
    'squats':    {'pushups': 0.10, 'handstand': 0.10, 'pullups': 0.20, 'squats': 1.00, 'legraises': 0.20, 'bridges': 0.40},
    'legraises': {'pushups': 0.10, 'handstand': 0.20, 'pullups': 0.30, 'squats': 0.20, 'legraises': 1.00, 'bridges': 0.50},
    'bridges':   {'pushups': 0.20, 'handstand': 0.30, 'pullups': 0.35, 'squats': 0.40, 'legraises': 0.50, 'bridges': 1.00},
}
CN = {'pushups': '俯卧撑', 'squats': '深蹲', 'pullups': '引体向上',
      'legraises': '举腿', 'bridges': '桥', 'handstand': '倒立撑'}
ORDER = {'pushups': 1, 'squats': 2, 'pullups': 3, 'legraises': 4, 'bridges': 5, 'handstand': 6}
W = {'recovery': 0.35, 'completion': 0.20, 'focus': 0.25, 'fatigue': 0.30, 'overlap': 0.25, 'stall': 0.15}
AW = {'score': 0.5, 'complement': 0.3, 'freshness': 0.2}
FLOOR_DAYS, FULL_DAYS = 1, 5
NEUTRAL, DECAY = 3.0, 0.6
FOCUS_PRIMARY, FOCUS_OTHERS = 1.00, 0.55
NO_HISTORY_COMPLETION = 0.75
MAX_OVERLAP_MAIN, MAX_OVERLAP_ASSIST = 0.60, 0.60
SEC_PER_REP = {'pushups': 4, 'handstand': 4, 'pullups': 5, 'squats': 3, 'legraises': 4, 'bridges': 4}

# ------------------------------------------------- 模拟数据（§10.1，today = 2026-09-30）
# slug -> (daysSince, avgCompletion, lastFatigue)
DEMO = {
    'pushups':   (1, 0.931, 4),
    'squats':    (7, 0.960, 3),
    'pullups':   (3, 0.970, 3),
    'legraises': (None, NO_HISTORY_COMPLETION, None),
    'bridges':   (5, 1.000, 2),
    'handstand': (None, NO_HISTORY_COMPLETION, None),
}
PRIMARY_ART = 'pushups'   # 原书顺序第一个未完成的艺
RECENT_48H = ['pushups']  # 落在 48h 窗口内的已训练艺

# 时间档预算（§7.4）
MINUTES_BUDGET = {
    15: {'maxItems': 2, 'mainOffset': 0, 'rest': 60, 'assistRest': 60, 'assistSetCap': 1, 'optional': False},
    30: {'maxItems': 3, 'mainOffset': 0, 'rest': 75, 'assistRest': 75, 'assistSetCap': 2, 'optional': True},
    45: {'maxItems': 4, 'mainOffset': 0, 'rest': 90, 'assistRest': 75, 'assistSetCap': 2, 'optional': True},
    60: {'maxItems': 5, 'mainOffset': 1, 'rest': 120, 'assistRest': 90, 'assistSetCap': 2, 'optional': True},
}
PREP_SECONDS = 60

# 各艺当前状态（§10.1）
LADDER = {  # 由 Move.trainingGoal 三档派生：(sets, perSet)
    'pushups':   [(1, 8), (2, 12), (2, 25)],
    'squats':    [(1, 10), (2, 15), (3, 30)],
    'pullups':   [(1, 8), (2, 11), (2, 15)],
    'legraises': [(1, 10), (2, 20), (3, 35)],
    'bridges':   [(1, 10), (2, 20), (3, 40)],
    'handstand': [('hold', 30), ('hold', 60), ('hold', 120)],
}
TIER = {'pushups': 1, 'squats': 1, 'pullups': 1, 'legraises': 0, 'bridges': 1, 'handstand': 0}


# ------------------------------------------------------------------ 因子函数（§5.3）
def recovery_need(days):
    if days is None:
        return 1.0
    return max(0.0, min(1.0, (days - FLOOR_DAYS) / (FULL_DAYS - FLOOR_DAYS)))


def completion_health(avg):
    """归一化：clamp(avg, 0, 1.2) / 1.2。这是最容易漏掉的一步。"""
    return min(avg, 1.2) / 1.2


def fatigue_load(days, last_fatigue):
    if last_fatigue is None or days is None:
        return 0.0
    decayed = NEUTRAL + (last_fatigue - NEUTRAL) * (DECAY ** days)
    return max(0.0, min(1.0, (decayed - NEUTRAL) / (5 - NEUTRAL)))


def overlap_with_recent(skill, recent):
    return max(MATRIX[r][skill] for r in recent) if recent else 0.0


def priority(skill, days, avg, last_fatigue, recent):
    factors = {
        'recovery': (recovery_need(days), W['recovery']),
        'completion': (completion_health(avg), W['completion']),
        'focus': ((FOCUS_PRIMARY if skill == PRIMARY_ART else FOCUS_OTHERS), W['focus']),
        'fatigue': (fatigue_load(days, last_fatigue), -W['fatigue']),
        'overlap': (overlap_with_recent(skill, recent), -W['overlap']),
        'stall': (0.0, -W['stall']),
    }
    total = sum(raw * weight for raw, weight in factors.values())
    return total, factors


def score_all(demo, recent):
    out = {}
    for slug, (days, avg, last_fatigue) in demo.items():
        out[slug] = priority(slug, days, avg, last_fatigue, recent)
    return out


def rank(scores):
    return sorted(scores, key=lambda s: (-scores[s][0], ORDER[s]))


def select_assists(main, scores, recent, count, max_main=MAX_OVERLAP_MAIN, max_between=MAX_OVERLAP_ASSIST):
    assists = {}
    for slug in scores:
        if slug == main:
            continue
        assists[slug] = (AW['score'] * scores[slug][0]
                         + AW['complement'] * (1 - MATRIX[main][slug])
                         - AW['freshness'] * overlap_with_recent(slug, recent))
    picked = []
    for slug in sorted(assists, key=lambda s: (-assists[s], ORDER[s])):
        if MATRIX[main][slug] > max_main:
            continue
        if any(MATRIX[p][slug] > max_between for p in picked):
            continue
        picked.append(slug)
        if len(picked) == count:
            break
    return picked, assists


def estimate(skill, sets, per_set, rest):
    return PREP_SECONDS + per_set * SEC_PER_REP[skill] * sets + rest * (sets - 1)


# ------------------------------------------------------------------------- 演示
def main():
    scores = score_all(DEMO, RECENT_48H)
    ranked = rank(scores)
    main_skill = ranked[0]

    print('=== §10.4 优先级打分 ===')
    for slug in sorted(DEMO, key=lambda s: ORDER[s]):
        total, f = scores[slug]
        parts = ' '.join(f'{k}={v[0]:.3f}({v[0]*v[1]:+.4f})' for k, v in f.items())
        print(f'  {CN[slug]:5} {parts} => {total:.4f}')
    print('  排名:', ' > '.join(f'{CN[s]}({scores[s][0]:.4f})' for s in ranked))
    print(f'  MAIN = {CN[main_skill]}')

    print('\n=== §10.5 辅助选择（main=%s）===' % CN[main_skill])
    picked45, assists = select_assists(main_skill, scores, RECENT_48H, count=3)
    for slug in sorted(assists, key=lambda s: -assists[s]):
        print(f'  {CN[slug]:5} {assists[slug]:.4f}  (与主训重叠 {MATRIX[main_skill][slug]:.2f})')
    print('  45min 辅助 =', ' + '.join(CN[s] for s in picked45))

    print('\n=== §10.6 耗时估算（45 分钟档）===')
    rest, assist_rest = MINUTES_BUDGET[45]['rest'], MINUTES_BUDGET[45]['assistRest']
    plan = [(main_skill, LADDER[main_skill][TIER[main_skill]], rest)]
    for slug in picked45:
        sets, per_set = LADDER[slug][TIER[slug]]
        sets = min(sets, MINUTES_BUDGET[45]['assistSetCap'])
        plan.append((slug, (sets, per_set), assist_rest))
    total_sec = 0
    for slug, (sets, per_set), r in plan:
        sec = estimate(slug, sets, per_set, r)
        total_sec += sec
        print(f'  {CN[slug]:5} {sets}组 x {per_set} {"秒" if per_set == "hold" else "次"} rest{r}s -> {sec/60:.1f}min')
    print(f'  合计 {total_sec/60:.1f}min ｜ 剩余 {45 - total_sec/60:.1f}min')

    print('\n=== §10.8 排除「引体向上」后重算 ===')
    demo2 = {k: v for k, v in DEMO.items() if k != 'pullups'}
    s2 = rank(score_all(demo2, RECENT_48H))
    m2 = s2[0]
    p2, _ = select_assists(m2, score_all(demo2, RECENT_48H), RECENT_48H, count=3)
    print(f'  主训 {CN[m2]} ｜ 辅助 ' + ' + '.join(CN[s] for s in p2))

    print('\n=== §10.9 改为 15 分钟 ===')
    b = MINUTES_BUDGET[15]
    sets, per_set = LADDER[main_skill][TIER[main_skill]]
    e1 = estimate(main_skill, sets, per_set, b['rest'])
    a_skill = picked45[0]
    a_sets, a_per = LADDER[a_skill][TIER[a_skill]]
    a_sets = min(a_sets, b['assistSetCap'])
    e2 = estimate(a_skill, a_sets, a_per, b['assistRest'])
    print(f'  主训 {CN[main_skill]} {sets}组x{per_set}次 = {e1/60:.1f}min')
    print(f'  辅助 {CN[a_skill]} {a_sets}组x{a_per}次 = {e2/60:.1f}min')
    print(f'  合计 {(e1+e2)/60:.1f}min ｜ 剩余 {15 - (e1+e2)/60:.1f}min')

    print('\n=== §10.10 冷启动（零历史）===')
    cold = {s: (None, NO_HISTORY_COMPLETION, None) for s in ORDER}
    s0 = rank(score_all(cold, []))
    m0 = s0[0]
    p0, _ = select_assists(m0, score_all(cold, []), [], count=3)
    print('  排名:', ' > '.join(f'{CN[s]}({score_all(cold, [])[s][0]:.4f})' for s in s0))
    print(f'  冷启动首日: {CN[m0]}（主）+ ' + ' + '.join(CN[s] for s in p0))

    # ---- 期望值断言（与文档 §10 一致）----
    expect_main_45 = 'squats'
    expect_assist_45 = ['legraises', 'pullups', 'bridges']
    expect_cold_main = 'pushups'
    expect_cold_assist = ['squats', 'pullups', 'legraises']
    assert main_skill == expect_main_45, f'main 应为 {expect_main_45}'
    assert picked45 == expect_assist_45, f'assist 应为 {expect_assist_45}'
    assert m0 == expect_cold_main, f'冷启动 main 应为 {expect_cold_main}'
    assert p0 == expect_cold_assist, f'冷启动 assist 应为 {expect_cold_assist}'
    assert abs(scores['squats'][0] - 0.6225) < 1e-4
    assert abs(scores['pushups'][0] - 0.0652) < 1e-4
    print('\n✅ 全部断言通过，与 docs/DYNAMIC-PLAN-DESIGN.md §10 一致。')


if __name__ == '__main__':
    main()
