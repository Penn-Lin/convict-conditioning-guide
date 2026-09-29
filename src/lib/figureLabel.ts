/**
 * 图位无障碍标签生成（架构 §5.4.5 / T02 §2.3 #22）。
 *
 * 背景：图片方案为「图位占位」，页面上只留尺寸正确的空位。图位需要一段
 * **即使无图也能描述动作本身**的可访问标签（`aria-label`），供读屏用户理解画面。
 *
 * 设计：本文件为纯函数工具，**仅依赖 `Move` / `Art` 类型**（不依赖任何数据层），
 * 因此 `FigureSlot` 等组件可零数据依赖地复用。
 *
 * 规则（固化为契约）：
 * 1. 移动式标签：`{nameZh}：{description 首句}`（中文全角冒号连接，去末尾句号）。
 * 2. 六艺封面标签：`{nameZh}：{tagline}`（`tagline` 末尾句号同样去除）。
 * 3. 整串长度上限 **60 字**，超出则截断并加省略号 `…`（保证读屏标签不过长）。
 * 4. 禁止出现文件名、序号括号、英文 slug 等噪音。
 */
import type { Art, Move } from '@/types';

/** 标签整串长度上限（含可能的省略号） */
const MAX_LABEL_LENGTH = 60;

/** 截断省略号 */
const ELLIPSIS = '…';

/** 中文句号（首句切分与末尾去除均用它） */
const SENTENCE_TERMINATOR = '。';

/** 名称与描述之间的全角冒号分隔符 */
const SEPARATOR = '：';

/**
 * 去除字符串末尾的一个或多个中文句号（并清理其后的空白）。
 *
 * @param text 原文
 * @returns 去除末尾句号后的文本
 */
function stripTrailingPeriod(text: string): string {
  let result = text.trim();
  while (result.endsWith(SENTENCE_TERMINATOR)) {
    result = result.slice(0, -SENTENCE_TERMINATOR.length).trimEnd();
  }
  return result;
}

/**
 * 取 `description` 的首句（按中文句号切分）并去掉末尾句号。
 * 若整段无句号，则原样（trim 后）返回，不额外补句号。
 *
 * @param description 动作描述
 * @returns 首句（无末尾句号）
 */
function firstSentence(description: string): string {
  const trimmed = description.trim();
  if (trimmed === '') return '';
  const end = trimmed.indexOf(SENTENCE_TERMINATOR);
  const sentence = end === -1 ? trimmed : trimmed.slice(0, end);
  return stripTrailingPeriod(sentence);
}

/**
 * 将整串标签按码点计数裁到上限内。
 * 超长时预留 1 个字符位给省略号，保证最终长度 **≤ 60 字**；恰好 60 字不截断、不加省略号。
 * 用 `Array.from` 按码点切分，避免代理对（如 emoji）被截半。
 *
 * @param label 未截断的完整标签
 */
function clampLabel(label: string): string {
  const chars = Array.from(label);
  if (chars.length <= MAX_LABEL_LENGTH) return label;
  const keep = MAX_LABEL_LENGTH - 1; // 预留省略号位，保证总长不超上限
  return chars.slice(0, keep).join('') + ELLIPSIS;
}

/**
 * 以全角冒号拼接「名称 + 说明」并做长度收敛。
 *
 * @param name   中文名称
 * @param detail 说明（首句 / 定位语）
 */
function joinLabel(name: string, detail: string): string {
  return clampLabel(`${name.trim()}${SEPARATOR}${detail}`);
}

/**
 * 构建十式主图的无障碍标签。
 * 格式：`{nameZh}：{description 首句}`（去末尾句号，整串 ≤ 60 字）。
 *
 * @param move 仅需 `nameZh` 与 `description` 两个字段
 * @returns 无障碍标签
 *
 * @example
 * buildMoveFigureLabel({ nameZh: '标准俯卧撑', description: '俯卧撑体系的基准动作，也是检验上肢推力水平的黄金标准。它是……' })
 * // => '标准俯卧撑：俯卧撑体系的基准动作，也是检验上肢推力水平的黄金标准'
 */
export function buildMoveFigureLabel(
  move: Pick<Move, 'nameZh' | 'description'>,
): string {
  return joinLabel(move.nameZh, firstSentence(move.description));
}

/**
 * 构建六艺封面的无障碍标签。
 * 格式：`{nameZh}：{tagline}`（`tagline` 末尾句号同样去除，整串 ≤ 60 字）。
 *
 * @param art 仅需 `nameZh` 与 `tagline` 两个字段
 * @returns 无障碍标签
 *
 * @example
 * buildArtFigureLabel({ nameZh: '俯卧撑', tagline: '上肢推力的根基' })
 * // => '俯卧撑：上肢推力的根基'
 */
export function buildArtFigureLabel(
  art: Pick<Art, 'nameZh' | 'tagline'>,
): string {
  return joinLabel(art.nameZh, stripTrailingPeriod(art.tagline));
}
