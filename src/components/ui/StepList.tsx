/**
 * StepList —— 分解步骤有序列表（v2 升级）。
 *
 * 层级完全依靠**大字号序号 + 缩进**表达，**不依赖颜色**：
 * 序号使用等宽大数字，正文使用常规字号，形成清晰的视觉阶梯。
 *
 * v2 新增：序号可套用所属艺的色相（`hueClass`），让同一页的步骤列表与顶部进度色一致；
 * 步骤正文接入富文本高亮（计量数字 / 要点 / 风险词自动上色）。
 */
import { RichText } from '@/components/ui/RichText';

export interface StepListProps {
  /** 有序步骤（顺序即序号 1..n） */
  steps: string[];
  className?: string;
  /** 序号底色类（默认中性 `bg-surface2`） */
  hueSoftClass?: string;
  /** 序号文字色类（默认 `text-text`） */
  hueTextClass?: string;
}

/**
 * 分解步骤列表。
 *
 * @example
 * <StepList steps={['手掌与肩同宽撑地', '身体保持一条直线', '屈肘下放至胸口']} />
 */
export function StepList({
  steps,
  className = '',
  hueSoftClass = 'bg-surface2',
  hueTextClass = 'text-text',
}: StepListProps) {
  return (
    <ol
      className={['m-0 flex list-none flex-col gap-3.5 p-0', className]
        .filter(Boolean)
        .join(' ')}
    >
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3">
          {/* 序号：大字号 + 等宽数字强化层级（不使用颜色承载信息） */}
          <span
            aria-hidden="true"
            className={[
              'tnum mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-base font-bold',
              hueSoftClass,
              hueTextClass,
            ].join(' ')}
          >
            {index + 1}
          </span>
          <RichText
            className="min-w-0 flex-1 pt-0.5 text-base leading-[1.75] text-text"
            text={step}
          />
        </li>
      ))}
    </ol>
  );
}
