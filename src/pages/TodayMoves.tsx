/**
 * TodayMoves —— 今日动作速览（翻页）。
 *
 * 路由 `/plan/today`。定位与边界见 `docs/TODAY-MOVES-DECK.md`：
 * **今日计划的横切视图** —— 页序 = 今天引擎排给你的训练顺序，一页一个动作，
 * 只回答「长什么样 / 今天做多少 / 关键几点」。
 *
 * 为什么要有它：第一次做的动作，原先必须逐个点进十式详情页（4 个动作 = 8 次点击 + 8 次返回），
 * 而详情页的信息量远大于此刻所需。这里把「练前过一遍」压缩成一次横滑。
 *
 * 它**不承担打卡**（那是 `LogSheet` 的职责）—— 一个界面只干一件事，两处都能改状态必然不一致。
 *
 * 三种状态：
 * ① 未完成首次设置 → 回训练页做设置（本页不做引导表单，避免同一个表单出现在两处）；
 * ② 恢复日 / 计划为空 → 空态，**不渲染空轨道**（一个空轨道比一句话更让人困惑）；
 * ③ 正常 → 页头 + 翻页轨道 + 收口的返回按钮。
 */
import { useMemo } from 'react';
import { CalendarDays, Info } from 'lucide-react';

import { SITE_NAME } from '@/lib/constants';
import { formatDateCn } from '@/lib/plan/time';
import { buildDeck } from '@/lib/plan/deck';
import { useDocumentMeta } from '@/lib/seo';
import { useTraining } from '@/hooks/TrainingProvider';

import { Button } from '@/components/ui/Button';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { MoveDeck } from '@/components/plan/MoveDeck';

export function TodayMoves() {
  useDocumentMeta(
    `今天的动作 · ${SITE_NAME}`,
    '把今天要练的动作摊成一页一个，左右滑动就能看完姿势图、要领与今天的训练量，不必逐个点进详情页。',
  );

  const { ready, plan, today } = useTraining();
  const deck = useMemo(() => buildDeck(plan), [plan]);

  return (
    <main className="mx-auto w-full max-w-3xl pb-nav pt-5">
      {/*
        页头刻意只有两行：这一页的主角是卡片，不是标题。
        不加面包屑 —— 底部标签栏的「训练」一直可见，返回路径不缺，
        而面包屑会占掉手机上近 50px 的首屏高度（卡片本来就比一屏略高）。
      */}
      <div className="px-4">
        <header>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-text">
            今天的动作
          </h1>
          <p className="tnum mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
            {formatDateCn(today)}
            {deck.length > 0 ? ` · 共 ${deck.length} 个动作` : ''}
          </p>
        </header>
      </div>

      {!ready ? (
        /* ① 还没做首次设置 */
        <div className="mt-4 px-4">
          <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <p className="text-base font-bold text-text">先设好训练节奏</p>
            <p className="mt-1.5 text-sm leading-[1.7] text-muted">
              今天的动作由训练计划算出来。花 20 秒在训练页做几个选择，之后每天打开就能直接翻。
            </p>
            <Button className="mt-3.5 w-full" size="lg" to="/plan">
              去训练页设置
            </Button>
          </div>
        </div>
      ) : deck.length === 0 ? (
        /* ② 恢复日 / 空计划 */
        <div className="mt-4 px-4">
          <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <p className="text-base font-bold text-text">今天没有训练项目</p>
            <p className="mt-1.5 text-sm leading-[1.7] text-muted">
              今天是恢复日 —— 走一走、拉伸一下，或者干脆休息。想练点什么的话，
              回训练页点「调整」清空排除项即可重算。
            </p>
            <Button className="mt-3.5 w-full" size="lg" variant="secondary" to="/plan">
              回到训练页
            </Button>
          </div>
        </div>
      ) : (
        /* ③ 正常：翻页轨道 */
        <div className="mt-3">
          <MoveDeck deck={deck} />

          <div className="mt-4 flex flex-col gap-3 px-4">
            <p className="flex items-start gap-2 rounded-md bg-surface2 px-3 py-2.5 text-xs leading-relaxed text-muted">
              <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
              <span>
                这里只放「现在这一下怎么做」。进阶条件打卡、训练目标三档、发力肌群在每页底部的
                「看完整动作要领」里。
              </span>
            </p>

            <Button className="w-full" size="lg" to="/plan">
              回到训练页开始记录
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 px-4">
        <SafetyNotice text="训练前请充分热身，循序渐进、量力而行；动作过程中出现疼痛请立即停止，有伤病者请先咨询专业人士。" />
      </div>
    </main>
  );
}

export default TodayMoves;
