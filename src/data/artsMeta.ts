/**
 * 六艺展示元数据（架构 §2.4 #29 · T02）。
 *
 * - 名称与顺序**严格按** `docs/content-reference.md` 第 1 节。
 * - `slug` 使用 kebab-case 路由标识（`leg-raises` / `handstand-pushups`）。
 * - `order` 为原书固定顺序 1–6。
 * - 【v1.3 变更】原「封面姿态」字段**已删除**：姿态/矢量渲染方案整体停用，改为图位占位
 *   （`FigureSlot` 预留真实图片位）。本文件只保留展示元数据。
 * - 本文件仅数据，无组件、无副作用；`moves` 字段在 `data/index.ts` 装配时补齐。
 */
import type { Art } from '@/types';

/** 艺元数据类型：`Art` 去掉 `moves`（由聚合层装配） */
export type ArtMeta = Omit<Art, 'moves'>;

/** 六艺展示元数据（已按 order 升序；聚合层仍会再排序一次以保证顺序） */
export const artsMeta: readonly ArtMeta[] = [
  {
    slug: 'pushups',
    order: 1,
    nameZh: '俯卧撑',
    nameEn: 'Push-ups',
    tagline: '上肢推力的根基，检验力量水平的黄金标准',
    intro:
      '俯卧撑是最古老、也最经得起考验的上肢推类动作，从墙壁到单臂的十式递进，逐级构建贯穿胸、肩、臂的推力链条。',
    muscles: ['胸大肌', '三角肌前束', '肱三头肌', '前锯肌'],
  },
  {
    slug: 'squats',
    order: 2,
    nameZh: '深蹲',
    nameEn: 'Squats',
    tagline: '下肢力量的基石，撬动全身爆发力',
    intro:
      '深蹲是人体最基础的下肢动作模式，十式由肩倒立深蹲一路进阶到单腿深蹲，塑造稳固而有力的下盘。',
    muscles: ['股四头肌', '臀大肌', '腘绳肌', '小腿三头肌', '核心肌群'],
  },
  {
    slug: 'pullups',
    order: 3,
    nameZh: '引体向上',
    nameEn: 'Pull-ups',
    tagline: '背部与拉力的王者，单杠上的力量阶梯',
    intro:
      '引体向上考验的是相对力量与背部控制，从垂直引体向上到单臂引体向上，十式逐级点燃背部拉力与抓握能力。',
    muscles: ['背阔肌', '肱二头肌', '斜方肌', '三角肌后束', '前臂肌群'],
  },
  {
    slug: 'leg-raises',
    order: 4,
    nameZh: '举腿',
    nameEn: 'Leg Raises',
    tagline: '锻造下腹与腰力的经典核心训练',
    intro:
      '举腿直击腹部深层与髋屈肌群，从坐姿屈膝到悬垂直举腿，循序构建强韧的核心与稳定的躯干。',
    muscles: ['腹直肌', '髂腰肌', '股四头肌', '腹斜肌'],
  },
  {
    slug: 'bridges',
    order: 5,
    nameZh: '桥',
    nameEn: 'Bridges',
    tagline: '唤醒背部与脊柱的完整力量链',
    intro:
      '桥是六艺中唯一强调身体后侧链的动作门类，从短桥到铁板桥，重点强化竖脊肌与脊柱灵活性（属高风险动作，务必循序渐进）。',
    muscles: ['竖脊肌', '臀大肌', '腘绳肌', '背阔肌', '肩部肌群'],
  },
  {
    slug: 'handstand-pushups',
    order: 6,
    nameZh: '倒立撑',
    nameEn: 'Handstand Push-ups',
    tagline: '上肢推力的终极形态，倒立世界的门槛',
    intro:
      '倒立撑将全身置于倒立姿态，是上肢推力的巅峰挑战，从靠墙顶立到单臂倒立撑，前 3 式为静态计时（高风险动作，须在保护或墙体支撑下练习）。',
    muscles: ['三角肌前束', '肱三头肌', '斜方肌', '胸大肌上束', '核心肌群'],
  },
];
