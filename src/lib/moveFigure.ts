/**
 * 十式动作图资源路径（v3 新增）。
 *
 * 图片来源：原书《囚徒健身》第一册六艺十式的动作示范照片，每式两张 ——
 * 起始姿势与结束姿势。资源放在 `public/actions/{艺 slug}/{两位式号}-{1|2}.jpg`。
 *
 * 设计约束：
 * - 本文件只做**路径派生**，不改动 `src/data/arts/*.ts`（60 式内容一字不动）；
 * - 用 `import.meta.env.BASE_URL` 拼前缀，部署到子路径时同样可用；
 * - 纯函数、无副作用，可在任何层复用。
 */

/** 资源目录名（相对站点根） */
const FIGURE_DIR = 'actions';

/** 图位序号：`1` = 起始姿势，`2` = 结束姿势 */
export type MoveFigureIndex = 1 | 2;

/**
 * 生成某一式动作图的地址。
 *
 * @param artSlug 艺 slug（如 `pushups`）
 * @param stepNo  式号（1–10）
 * @param index   图位序号（1 起始 / 2 结束）
 *
 * @example
 * moveFigureSrc('pushups', 3, 1)
 * // => '/actions/pushups/03-1.jpg'
 */
export function moveFigureSrc(
  artSlug: string,
  stepNo: number,
  index: MoveFigureIndex,
): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const padded = String(stepNo).padStart(2, '0');
  return `${prefix}${FIGURE_DIR}/${artSlug}/${padded}-${index}.jpg`;
}
