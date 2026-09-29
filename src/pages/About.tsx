/**
 * About —— 关于 / 免责页（路由 `/about` · 架构 §4.1 / §7 T08；PRD P0-9 · §9 内容安全要求）。
 *
 * 必含四块（T08 验收点）：
 * ① 作品与作者说明；② 内容来源标注（内容基于 Paul Wade《囚徒健身》整理）；
 * ③ 版权声明；④ **医疗免责声明**（本站为健身科普与动作指导，非医疗建议；
 *    因训练导致的伤害本站不承担责任）。
 *
 * 约定（本任务硬约束）：每页唯一 `<h1>`；站内跳转 `<Link>`（含 `Button`），不整页刷新；
 * **正文 ≥16px、行高 ≥1.7**（免责与安全等承载信息的文字均不低于 16px）；
 * 零硬编码色值，全部语义 token，浅 / 深主题自适应。
 */
import { Link } from 'react-router-dom';
import { TriangleAlert, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { SITE_NAME } from '@/lib/constants';
import { useDocumentMeta } from '@/lib/seo';

/** 正文段落统一样式（正文级字号 + ≥1.7 行高） */
const BODY_CLASS = 'text-base leading-[1.7] text-text';

/** 页面主容器样式 */
const CONTAINER_CLASS = 'mx-auto w-full max-w-3xl px-4 pb-nav pt-6 md:pt-8';

/**
 * 关于 / 免责页。
 *
 * @example
 * // 由 App.tsx 的路由表挂载于 /about
 */
export function About() {
  useDocumentMeta(
    '关于本站 · 囚徒健身 · 六艺十式动作指导站',
    '关于本站：作品与作者说明、内容来源标注、版权声明与医疗免责声明。本站为健身科普与动作指导，非医疗建议。',
  );

  /** 版权年份（客户端渲染，取当前年） */
  const year = new Date().getFullYear();

  return (
    <main className={CONTAINER_CLASS}>
      {/* 页头 */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold leading-tight text-text sm:text-3xl">
          关于本站
        </h1>
        <p className="mt-3 text-base leading-[1.7] text-muted">
          这是一个把《囚徒健身》「六艺十式」体系整理成<b className="text-text">
            结构化动作指导
          </b>
          的查阅站点，为在手机上随时对照练习而做。
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* ① 作品与作者说明 */}
        <SectionCard id="about-project" title="这是什么">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              《囚徒健身》把自重训练归纳为六门基础动作（六艺），每门又拆成十个由易到难的
              递进动作（十式），合起来是 60 式。
            </p>
            <p className={BODY_CLASS}>
              本站把这 60 式重新整理为统一的结构化内容——动作描述、分解步骤、要领要点、
              常见错误、进阶标准与训练目标——并根据「难度」把它们排成一条清晰的进阶路径，
              方便你在训练中随时查阅、按部就班地推进。
            </p>
            <p className={BODY_CLASS}>
              本站是一个<b>非商业性的个人学习参考项目</b>，目的是整理与查阅，不替代原书，
              也不替代任何专业教练或医生的指导。
            </p>
          </div>
        </SectionCard>

        {/* ② 内容来源标注 */}
        <SectionCard id="about-source" title="内容来源与致谢">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              本站内容基于 <b>Paul Wade</b> 所著《囚徒健身》（Convict Conditioning）整理编写，
              并参照其官方中文版（北京科学技术出版社）核对动作名称与训练数值。
            </p>
            <p className={BODY_CLASS}>
              书中的「六艺十式」体系、动作顺序与训练标准，著作权归原作者与出版方所有。
              在此向作者与中文版译者、出版方致谢。
            </p>
          </div>
        </SectionCard>

        {/* ③ 版权声明 */}
        <SectionCard id="about-copyright" title="版权声明">
          <div className="flex flex-col gap-3">
            <p className={BODY_CLASS}>
              本站为学习与查阅目的对原书内容进行<b>二次整理与改写</b>，不提供原书原文的转载，
              也不用于任何商业用途。
            </p>
            <p className={BODY_CLASS}>
              站内的文字表述若与原书存在出入，请以原书为准；如相关内容涉及版权问题，
              请与我们联系，我们会及时更正或删除。
            </p>
            <p className="text-base leading-[1.7] text-muted">
              © {year} {SITE_NAME}。站内整理内容保留所有权利。
            </p>
          </div>
        </SectionCard>

        {/* ④ 医疗免责声明（醒目、居要位；承载关键信息 → 正文级字号） */}
        <section
          id="medical-disclaimer"
          aria-labelledby="medical-disclaimer-heading"
          className="rounded-md border border-danger/70 border-l-4 bg-danger/5 p-4 sm:p-5"
        >
          <h2
            id="medical-disclaimer-heading"
            className="mb-3 flex items-center gap-2 text-lg font-semibold leading-snug text-text"
          >
            <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-danger" />
            医疗免责声明
          </h2>
          <p className={BODY_CLASS}>
            本站为健身科普与动作指导，<b>不是医疗建议</b>，也不能替代医生或专业教练的诊断与指导。
            开始任何训练前，请先评估自身健康状况；如有伤病、慢性病，或不确定是否适合训练，
            请先咨询医生。
          </p>
          <p className={`mt-3 ${BODY_CLASS}`}>
            任何训练都有受伤风险，请对自己的安全负责。
            <b>因参照本站内容进行训练而导致的任何伤害或损失，本站及内容维护者不承担责任。</b>
          </p>
        </section>

        {/* 训练安全提示 + 训练原则入口 */}
        <section
          id="safety"
          aria-labelledby="safety-heading"
          className="rounded-md border border-border border-l-4 border-l-accent bg-surface p-4 sm:p-5"
        >
          <h2
            id="safety-heading"
            className="mb-3 flex items-center gap-2 text-lg font-semibold leading-snug text-text"
          >
            <Shield aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />
            训练安全提示
          </h2>
          <p className={BODY_CLASS}>
            量力而行、循序渐进，出现疼痛立即停止；有伤病者请先咨询医生。
            <Link
              to="/principles"
              className="ml-1 font-medium text-accent underline underline-offset-2 hover:opacity-90"
            >
              查看训练原则
            </Link>
          </p>
        </section>
      </div>

      {/* 页尾 CTA */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button to="/">返回首页</Button>
        <Button to="/arts" variant="secondary">
          浏览六艺
        </Button>
      </div>
    </main>
  );
}

export default About;
