/**
 * 数据聚合层（架构 §3.2 · T02）。
 *
 * 职责：
 * 1. 装配 6 艺：以 `artsMeta` 的元数据 + 各艺 moves 数组组装为 `Art`，按 `order` 升序导出 `arts`。
 * 2. 派生进阶链路：对每艺 moves 数组**按下标**生成 `prevStep` / `nextStep`
 *    （`href = /arts/{artSlug}/{stepNo}`，边界为 `null`），数据文件无需手写。
 * 3. 扁平化导出 `allMoves`（`ResolvedMove[]`），供 sitemap / 检索 / 快速跳转使用。
 * 4. 提供全部查询函数（§3.2）。
 *
 * 派生逻辑抽为**纯函数**（`attachAdjacency` / `resolveMove`）便于单测；本文件无副作用。
 * 数组为空时（占位阶段）聚合层须正常工作：返回空数组、不抛异常、`getArt` 仍返回艺对象。
 */
import type { Art, ArtSlug, Move, ResolvedMove, StepRef } from '@/types';
import { moveHref, moveSlug } from '@/lib/slug';
import { artsMeta } from '@/data/artsMeta';
import { pushupMoves } from '@/data/arts/pushups';
import { squatMoves } from '@/data/arts/squats';
import { pullupMoves } from '@/data/arts/pullups';
import { legRaiseMoves } from '@/data/arts/legRaises';
import { bridgeMoves } from '@/data/arts/bridges';
import { handstandPushupMoves } from '@/data/arts/handstandPushups';

/* ---------------------------------------------------------------------------
 * 纯函数：派生逻辑（可单测）
 * ------------------------------------------------------------------------ */

/** 构造一个相邻式的精简引用 */
function makeStepRef(
  artSlug: ArtSlug,
  stepNo: number,
  nameZh: string,
): StepRef {
  return { stepNo, nameZh, href: moveHref(artSlug, stepNo) };
}

/**
 * 为某艺的 moves 数组**按下标**派生 `prevStep` / `nextStep`（纯函数）。
 *
 * - 首式 `prevStep = null`；末式 `nextStep = null`。
 * - 中间式的 `prevStep.stepNo = 前一式 stepNo`、`nextStep.stepNo = 后一式 stepNo`。
 * - 空数组安全：返回空数组，不抛异常。
 *
 * @param moves   某艺的 moves（顺序 = stepNo 递增）
 * @param artSlug 该艺 slug（用于生成 href）
 * @returns 已补齐相邻引用的新数组（不修改入参）
 */
export function attachAdjacency(
  moves: readonly Move[],
  artSlug: ArtSlug,
): Move[] {
  const lastIndex = moves.length - 1;
  return moves.map((move, index) => {
    const prev = index > 0 ? moves[index - 1] : undefined;
    const next = index < lastIndex ? moves[index + 1] : undefined;
    return {
      ...move,
      prevStep: prev ? makeStepRef(artSlug, prev.stepNo, prev.nameZh) : null,
      nextStep: next ? makeStepRef(artSlug, next.stepNo, next.nameZh) : null,
    };
  });
}

/**
 * 将一条已含相邻引用的 `Move` 解析为完整视图 `ResolvedMove`（纯函数）。
 *
 * 保证 `prevStep` / `nextStep` 非 `undefined`（缺失补 `null`），并补齐 `slug`。
 *
 * @param move    原始（或已派生）式
 * @param artSlug 所属艺 slug
 */
export function resolveMove(move: Move, artSlug: ArtSlug): ResolvedMove {
  return {
    ...move,
    prevStep: move.prevStep ?? null,
    nextStep: move.nextStep ?? null,
    slug: moveSlug(artSlug, move.stepNo),
  };
}

/* ---------------------------------------------------------------------------
 * 装配
 * ------------------------------------------------------------------------ */

/** artSlug → 该艺 moves 数组（占位阶段均为空数组） */
const MOVES_BY_ART: Record<ArtSlug, Move[]> = {
  pushups: pushupMoves,
  squats: squatMoves,
  pullups: pullupMoves,
  'leg-raises': legRaiseMoves,
  bridges: bridgeMoves,
  'handstand-pushups': handstandPushupMoves,
};

/** 全部六艺（按 order 升序），聚合后 prevStep/nextStep 已补齐 */
export const arts: Art[] = [...artsMeta]
  .sort((a, b) => a.order - b.order)
  .map((meta) => ({
    ...meta,
    moves: attachAdjacency(MOVES_BY_ART[meta.slug] ?? [], meta.slug),
  }));

/** 扁平化的 60 式（已 resolve），用于 sitemap / 检索 / 快速跳转 */
export const allMoves: ResolvedMove[] = arts.flatMap((art) =>
  art.moves.map((move) => resolveMove(move, art.slug)),
);

/* ---------------------------------------------------------------------------
 * 查询函数（架构 §3.2）
 * ------------------------------------------------------------------------ */

/** 按 slug 取艺 */
export function getArt(slug: string): Art | undefined {
  return arts.find((art) => art.slug === slug);
}

/** 按 artSlug + stepNo 取式 */
export function getMove(
  artSlug: string,
  stepNo: number,
): ResolvedMove | undefined {
  return allMoves.find(
    (move) => move.artRef.slug === artSlug && move.stepNo === stepNo,
  );
}

/** 按 move slug（如 pushups-05）取式 */
export function getMoveBySlug(slug: string): ResolvedMove | undefined {
  return allMoves.find((move) => move.slug === slug);
}

/** 取某艺的全部式 */
export function getMovesByArt(artSlug: ArtSlug): ResolvedMove[] {
  return allMoves.filter((move) => move.artRef.slug === artSlug);
}

/** 取相邻艺（用于六艺详情页 上一艺/下一艺） */
export function getAdjacentArts(slug: ArtSlug): { prev?: Art; next?: Art } {
  const index = arts.findIndex((art) => art.slug === slug);
  if (index === -1) return {};
  return {
    prev: index > 0 ? arts[index - 1] : undefined,
    next: index < arts.length - 1 ? arts[index + 1] : undefined,
  };
}
