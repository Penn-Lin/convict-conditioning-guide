/**
 * 全站常量与映射（架构 §9.3.4 / T02）。
 *
 * 职责：
 * - 六艺固定顺序（原书顺序，不可调换）。
 * - `MoveDifficulty` 五档与序号区间的映射（1-2 入门 / 3-4 初级 / 5-6 中级 /
 *   7-8 进阶 / 9-10 高阶）。
 * - 难度等级 → Tailwind token 色名映射（对齐 §9.3.4 的 `lv-1..lv-5`）。
 * - 通用文案常量与持久化键。
 *
 * 约定：本文件为纯常量 + 纯函数，无任何副作用。
 */
import type { ArtSlug, MoveDifficulty } from '@/types';

/* ---------------------------------------------------------------------------
 * 站点级文案常量
 * ------------------------------------------------------------------------ */

/** 站点名称（与 index.html <title> 保持一致） */
export const SITE_NAME = '囚徒健身 · 六艺十式动作指导站';

/** 站点默认描述（与 index.html <meta name="description"> 保持一致） */
export const SITE_DESCRIPTION =
  '《囚徒健身》六艺十式（60 式）结构化动作指导：分解步骤、要领要点、常见错误、进阶标准与安全提示，专为手机阅读优化。';

/* ---------------------------------------------------------------------------
 * 六艺顺序与序号区间
 * ------------------------------------------------------------------------ */

/** 六艺固定原书顺序：俯卧撑 → 深蹲 → 引体向上 → 举腿 → 桥 → 倒立撑 */
export const ART_ORDER: readonly ArtSlug[] = [
  'pushups',
  'squats',
  'pullups',
  'leg-raises',
  'bridges',
  'handstand-pushups',
];

/** 艺的数量（固定 6） */
export const ART_COUNT = ART_ORDER.length;

/** 每艺的式数（固定 10） */
export const MOVES_PER_ART = 10;

/** 最小有效序号 */
export const MIN_STEP_NO = 1;

/** 最大有效序号 */
export const MAX_STEP_NO = MOVES_PER_ART;

/* ---------------------------------------------------------------------------
 * 持久化键（须与 index.html 内联脚本一致）
 * ------------------------------------------------------------------------ */

/** 主题偏好持久化键（值：'light' | 'dark' | 'system'，首版仅用 light/dark） */
export const THEME_STORAGE_KEY = 'theme';

/* ---------------------------------------------------------------------------
 * 难度等级：五档、序号映射、token 色名映射
 * ------------------------------------------------------------------------ */

/** 难度等级升序排列（1→5） */
export const DIFFICULTY_LEVELS: readonly MoveDifficulty[] = [
  '入门',
  '初级',
  '中级',
  '进阶',
  '高阶',
];

/**
 * 难度 → Tailwind token 色名映射（架构 §9.3.4）。
 * 颜色仅作辅助，UI 必须同时输出文字标签（§9.7.2）。
 */
export const DIFFICULTY_TOKEN: Record<MoveDifficulty, string> = {
  入门: 'lv-1',
  初级: 'lv-2',
  中级: 'lv-3',
  进阶: 'lv-4',
  高阶: 'lv-5',
};

/** 难度 → 数字序（1–5），用于排序 / 比较 */
export const DIFFICULTY_RANK: Record<MoveDifficulty, number> = {
  入门: 1,
  初级: 2,
  中级: 3,
  进阶: 4,
  高阶: 5,
};

/** 序号区间 → 难度 档位表（闭区间） */
export const STEP_NO_BANDS: readonly {
  readonly from: number;
  readonly to: number;
  readonly difficulty: MoveDifficulty;
}[] = [
  { from: 1, to: 2, difficulty: '入门' },
  { from: 3, to: 4, difficulty: '初级' },
  { from: 5, to: 6, difficulty: '中级' },
  { from: 7, to: 8, difficulty: '进阶' },
  { from: 9, to: 10, difficulty: '高阶' },
];

/**
 * 由序号推导难度等级（纯函数）。
 *
 * @param stepNo 序号（1–10）
 * @returns 命中区间则返回对应难度，越界返回 `undefined`
 */
export function difficultyFromStepNo(stepNo: number): MoveDifficulty | undefined {
  return STEP_NO_BANDS.find((band) => stepNo >= band.from && stepNo <= band.to)
    ?.difficulty;
}
