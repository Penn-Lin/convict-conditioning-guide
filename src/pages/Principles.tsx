/**
 * Principles —— 训练原则页（路由 `/principles` · 架构 §4.1 / §7 T08；PRD P0-8）。
 *
 * 内容为原书**方法论要点**（渐进原则 / 不要练到力竭 / 组间休息 / 训练频率 / 安全提示），
 * **以本站自己的表述撰写**（不摘抄原书段落），目的是防止「误练」——先把怎么练讲清楚，
 * 再进到具体动作。
 *
 * 约定（本任务硬约束）：
 * - 每页唯一 `<h1>`；标题层级 h1 → h2 不跳级；
 * - 站内跳转一律 `<Link>`（含 `Button` 的链接形态），不整页刷新；
 * - **正文 ≥16px、行高 ≥1.7**：全页承载信息的文字均用 16px + `leading-[1.7]`，
 *   层级靠字重 / 颜色 / 等宽字体区分，不靠缩小字号；
 * - 零硬编码色值，全部语义 token，浅 / 深主题自适应。
 */
import { Link } from 'react-router-dom';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/Button';
import { useDocumentMeta } from '@/lib/seo';

/** 训练频率模板的每一天（仅作示例，可自行调整） */
interface FrequencyRow {
  /** 周几 */
  day: string;
  /** 当日安排 */
  plan: string;
}

/** 每周训练频率模板（示例） */
const FREQUENCY_TEMPLATE: readonly FrequencyRow[] = [
  { day: '周一', plan: '训练：俯卧撑 + 深蹲' },
  { day: '周二', plan: '休息' },
  { day: '周三', plan: '训练：引体向上 + 举腿' },
  { day: '周四', plan: '休息' },
  { day: '周五', plan: '训练：桥 + 倒立撑' },
  { day: '周六', plan: '休息 / 轻活动（散步、拉伸）' },
  { day: '周日', plan: '休息' },
];

/** 安全提示要点（正文级字号） */
const SAFETY_RULES: readonly string[] = [
  '训练前先充分热身，让关节和肌肉进入状态。',
  '量力而行、循序渐进；宁可降阶，也不要勉强完成做不动的动作。',
  '出现疼痛（不同于正常的肌肉酸胀）要立即停止，不要「忍一忍就过去了」。',
  '有旧伤、慢性病，或正处于特殊生理阶段，请先咨询医生，再决定是否开始训练。',
  '桥系、倒立撑全系等高负荷动作，务必在保护或墙体支撑下练习，并确认前序式已扎实完成。',
];

/** 正文段落统一样式（正文级字号 + ≥1.7 行高） */
const BODY_CLASS = 'text-base leading-[1.7] text-text';

/** 页面主容器样式 */
const CONTAINER_CLASS = 'mx-auto w-full max-w-3xl px-4 pb-nav pt-6 md:pt-8';

/**
 * 训练原则页。
 *
 * @example
 * // 由 App.tsx 的路由表挂载于 /principles
 */
export function Principles() {
  useDocumentMeta(
    '训练原则 · 囚徒健身 · 六艺十式动作指导站',
    '六艺十式的通用训练原则：渐进推进、不练到力竭、组间充分休息、合理的训练频率与安全提示，帮助你安全、可持续地变强。',
  );

  return (
    <main className={CONTAINER_CLASS}>
      {/* 页头 */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-text sm:text-3xl">
          训练原则
        </h1>
        <p className="mt-3 text-base leading-[1.7] text-muted">
          在动手练之前，先把「怎么练」想清楚。下面五条原则适用于全部六艺十式，读一遍再开始，
          能让你少走很多弯路、也少受很多伤。
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* ① 渐进原则 */}
        <SectionCard id="progression" title="一、渐进原则：按式推进，别跳级">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              每一艺的十式，本身就是一条由易到难的阶梯。正确的做法是从第 1 式起步，
              只有当你能<b>按标准</b>完成当前式的进阶目标之后，才进入下一式。
            </p>
            <p className={BODY_CLASS}>
              每一式的数据里都写着三档目标：<b>初级标准 / 中级标准 / 升阶标准</b>。
              它们不是「三个可选难度」，而是<b>同一条进度线上的三个刻度</b>——
              回答的是「你在这一式上走到哪了」，不是「你今天想练哪个」。
            </p>
            <p className={BODY_CLASS}>
              原书的推进路线是：先用初级标准起步，一周或两周加一次反复，
              直到能一组做到十次；<b>然后开始每次做两个锻炼组</b>，把两组都练到中级标准；
              再按需要加到第三组，直到满足升阶标准，才换下一式。
            </p>
            <p className={BODY_CLASS}>
              所以「今天该用哪一档」的答案很简单：<b>能标准完成哪一档，就用哪一档</b>。
              本站默认按你最近几次的实际完成度自动决定，你也可以在训练页的「调整」里手动指定——
              想试更高档不必等系统批准，做不到只影响当天，不会改掉长期进度。
            </p>
            <p className={BODY_CLASS}>
              不要因为某一式看着简单就跳过，也不要因为进度慢就硬上高难度的式。力量的增长来自
              「长期、稳定、可恢复」的刺激，而不是某一次的超常发挥。任何一次勉强冲级，换来的
              往往是动作变形和关节损伤。
            </p>
            <p className={BODY_CLASS}>
              判断能不能进阶，看的是「动作质量」而不是「哪天状态好」：姿势标准、节奏可控、
              没有借力，才算真的达标。
            </p>
          </div>
        </SectionCard>

        {/* ② 不要练到力竭 */}
        <SectionCard id="no-failure" title="二、不要练到力竭">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              每一组都请留一点余力。训练的目标是「把动作做对」，不是「把自己做到做不动」。
            </p>
            <p className={BODY_CLASS}>
              一组结束的信号，是姿势开始变形、速度失控、身体靠摆动借力——<b>在这之前就该停</b>，
              而不是等到「再也起不来」才停。每组都练到力竭，会让之后的组越做越差，也让恢复变慢，
              长期反而拖慢进度。
            </p>
          </div>
        </SectionCard>

        {/* ③ 组间休息 */}
        <SectionCard id="rest" title="三、组间休息：休息够，才做得动">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              先说清楚一件事：<b>原书没有规定具体的休息秒数。</b>
              原话是「组间休息多久，那要看你的目标……这没有什么规定，完全要看你的个人情况。
              如果你发现自己需要在组间休息 5 分钟才能恢复大部分气力，那就休息 5 分钟。」
            </p>
            <p className={BODY_CLASS}>
              判据只有一个：<b>下一组能不能全力以赴</b>。本站计划卡上写的
              「组间休息参考 45 秒 / 60 秒 / 75 秒」是为了让计划可执行而给的参考值，
              不是上限——没恢复就继续休息，感觉好了再开始。
            </p>
            <p className={BODY_CLASS}>
              唯一需要注意的上限来自原书：如果你需要休息超过 5 分钟，身体会开始冷却。
              这时别坐着等，起身走动几步、伸展一下正在练的部位，把血液循环维持住。
            </p>
            <p className={BODY_CLASS}>
              刻意缩短休息并不会让你变强，只会让后面几组的质量更差——那是「累」，不是「进步」。
            </p>
          </div>
        </SectionCard>

        {/* ④ 训练频率 */}
        <SectionCard id="frequency" title="四、训练频率：给身体留出恢复时间">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              力量的增长发生在休息里，而不是训练里。建议把每个动作安排为「每周练 3–4 次、
              以隔天为好」，避免同一肌群天天硬练。新手可以从每周 2–3 次起步，先让身体习惯，
              再逐步增加。
            </p>
            <p className={BODY_CLASS}>
              下面是一份可以直接照搬的每周模板（只是示例，请按自己的体力与恢复情况调整）：
            </p>

            {/* 频率模板：用列表而非 <table>，避免窄屏横向滚动 */}
            <ul
              aria-label="每周训练频率模板（示例）"
              className="mt-1 divide-y divide-border overflow-hidden rounded-md border border-border"
            >
              {FREQUENCY_TEMPLATE.map((row) => (
                <li
                  key={row.day}
                  className="flex items-baseline gap-3 bg-surface px-3 py-2.5 text-base leading-[1.7]"
                >
                  <span className="w-12 shrink-0 font-mono text-muted">
                    {row.day}
                  </span>
                  <span className="text-text">{row.plan}</span>
                </li>
              ))}
            </ul>

            <p className={BODY_CLASS}>
              如果想按「六艺」的完整顺序来安排，也可以把六门动作轮着练：
              <Link
                to="/arts"
                className="ml-1 font-medium text-accent underline underline-offset-2 hover:opacity-90"
              >
                浏览六艺总览
              </Link>
              ，再决定每周从哪几门开始。
            </p>
          </div>
        </SectionCard>

        {/* ⑤ 安全提示 */}
        <SectionCard id="safety" title="五、安全提示">
          <div className="flex flex-col gap-3">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-[1.7] text-text marker:text-danger">
              {SAFETY_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className={BODY_CLASS}>
              本站为健身科普与动作指导，非医疗建议。任何训练都存在风险，请对自己的身体负责；
              因训练导致的伤害，本站不承担责任。
              <Link
                to="/about"
                className="ml-1 font-medium text-accent underline underline-offset-2 hover:opacity-90"
              >
                查看完整免责声明
              </Link>
            </p>
          </div>
        </SectionCard>
      </div>

      {/* 页尾 CTA */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button to="/arts">开始浏览六艺</Button>
        <Button to="/" variant="secondary">
          返回首页
        </Button>
      </div>
    </main>
  );
}

export default Principles;
