/**
 * 日期 / 时间工具（纯函数）。
 *
 * **全部按 UTC 解析**，不使用 `new Date()` 的本地时区推断 —— 这样
 * 「几天前」这类判断在单测里完全可复现，不会因为跑测试的机器时区而漂移。
 *
 * 支持两种输入：
 * - 日期：`'YYYY-MM-DD'`
 * - 时刻：`'YYYY-MM-DDTHH:mm:ss'`（也接受 `'YYYY-MM-DD HH:mm:ss'`）
 *
 * 引擎**绝不读系统时间**：所有「今天 / 现在」都由调用方以参数传入。
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/** 中文星期名（下标 0 = 周日，对齐 `Date.getUTCDay()`） */
const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** 把 `'YYYY-MM-DD'` 解析为 UTC 毫秒时间戳（只取日期部分，时间归零） */
export function parseDate(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/** 把 `'YYYY-MM-DD'` 或 `'YYYY-MM-DDTHH:mm:ss'` 解析为 UTC 毫秒时间戳 */
export function parseInstant(iso: string): number {
  const normalized = iso.trim().replace(' ', 'T');
  const [datePart, timePart = '00:00:00'] = normalized.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm, ss] = timePart.split(':').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, Math.floor(ss ?? 0));
}

/** 毫秒时间戳 → `'YYYY-MM-DD'` */
export function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 毫秒时间戳 → `'YYYY-MM-DDTHH:mm:ss'`（去掉毫秒与时区后缀） */
export function formatInstant(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

/** 两个日期之间相差的天数（`to − from`，向下取整） */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to) - parseDate(from)) / MS_PER_DAY);
}

/** 两个时刻之间相差的小时数（`to − from`，保留 1 位小数） */
export function hoursBetween(from: string, to: string): number {
  return Math.round(((parseInstant(to) - parseInstant(from)) / MS_PER_HOUR) * 10) / 10;
}

/** 日期加减天数 */
export function addDays(date: string, delta: number): string {
  return formatDate(parseDate(date) + delta * MS_PER_DAY);
}

/** 星期序号：周一 = 1 … 周日 = 7 */
export function weekdayIndex(date: string): number {
  const day = new Date(parseDate(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** 该日期所在周的周一 */
export function weekStart(date: string): string {
  return addDays(date, -(weekdayIndex(date) - 1));
}

/**
 * 从「今天」算起、含今天在内本周还剩几天（含今天）。
 *
 * @example
 * // 2026-09-30 是周三 → 周三~周日 = 5 天
 * daysLeftInWeek('2026-09-30') // 5
 */
export function daysLeftInWeek(date: string): number {
  return 8 - weekdayIndex(date);
}

/** `'2026-09-30'` → `'2026-09-30 周三'` */
export function formatDateCn(date: string): string {
  const day = new Date(parseDate(date)).getUTCDay();
  return `${date.slice(0, 10)} ${WEEKDAY_CN[day]}`;
}

/** `'2026-09-30'` → `'9月30日'` */
export function formatMonthDay(date: string): string {
  const [, m, d] = date.slice(0, 10).split('-').map(Number);
  return `${m}月${d}日`;
}

/** 生成确定性 id（引擎零随机：同输入 → 同 id，便于单测与回放） */
export function makeId(prefix: string, ...parts: (string | number)[]): string {
  return [prefix, ...parts].join('-');
}
