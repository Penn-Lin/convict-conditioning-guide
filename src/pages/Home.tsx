/**
 * Home —— 首页（架构 §4.1 / PRD §3.2 · P0-1 · T09）。
 *
 * 信息架构（自上而下）：
 * - **Hero**：项目名（`SITE_NAME`）+ 一句话价值 + CTA（浏览六艺 / 训练原则）；
 * - **六艺封面网格**：从 `@/data` 取 `arts`，渲染 6 张 `ArtCard`（封面图位 3/4）；
 * - **「如何开始」三步引导**：有序列表，纯文案，不硬编码任何艺名 / 式名 / 路径；
 * - **安全提示**：`SafetyNotice`（内置跳转「训练原则」入口）；
 * - **继续了解**：训练原则 / 关于（免责）两个入口。
 *
 * 约束：站内跳转一律 `<Link>`（或经 `Button` 的 `to`）；响应式为**移动优先**
 * （六艺网格：移动 1 列 / 平板 2 列 / 桌面 3×2）；颜色只走语义 token（零硬编码色值）；
 * 正文字号 ≥16px、行高 ≥1.7；可点元素触控目标 ≥44×44px。
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, ListOrdered, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { arts } from '@/data';
import { ArtCard } from '@/components/ui/ArtCard';
import { Button } from '@/components/ui/Button';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { useDocumentMeta } from '@/lib/seo';
import { SITE_NAME } from '@/lib/constants';

/** 「如何开始」单个步骤 */
interface StartStep {
  /** 步骤图标 */
  icon: LucideIcon;
  /** 步骤标题 */
  title: string;
  /** 步骤说明 */
  body: string;
}

/** 「如何开始」三步引导（文案不含任何具体艺名 / 式名 / 路径） */
const START_STEPS: readonly StartStep[] = [
  {
    icon: Compass,
    title: '选一门艺',
    body: '进入「六艺总览」，按原书顺序从第一门开始。六门艺彼此独立，一次专注一门、不贪多。',
  },
  {
    icon: ListOrdered,
    title: '从第 1 式练起',
    body: '打开该艺详情，从第 1 式开始练；每式都给出分解步骤、要领要点与常见错误，照着做即可。',
  },
  {
    icon: TrendingUp,
    title: '达标后再进阶',
    body: '达到每式的「进阶标准」再练下一式，逐级推进到本艺第十式，然后换下一门。',
  },
];

export function Home() {
  useDocumentMeta(
    `首页 · ${SITE_NAME}`,
    '《囚徒健身》六艺十式（共 60 式）在线动作指导：六门基础动作、每门十式渐进，含分解步骤、要领要点、常见错误与进阶标准，专为手机阅读优化。',
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* ① Hero：项目名 + 一句话价值 + CTA */}
      <section className="rounded-lg border border-border bg-surface p-6 sm:p-10">
        <p className="font-mono text-xs tracking-wide text-muted">六艺 · 十式 · 60 个动作</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-text sm:text-4xl">
          {SITE_NAME}
        </h1>
        <p className="mt-4 max-w-prose text-base leading-[1.7] text-text">
          用结构化的「分解步骤 + 要领要点 + 常见错误 + 进阶标准」，把《囚徒健身》六艺十式共
          60 个动作，变成随手可查、照着能做的随身教练。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button to="/arts" size="lg">
            浏览六艺
          </Button>
          <Button to="/principles" variant="secondary" size="lg">
            训练原则与安全
          </Button>
        </div>
      </section>

      {/* ② 六艺封面网格（移动 1 列 / 平板 2 列 / 桌面 3×2） */}
      <section aria-labelledby="home-arts-heading" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="home-arts-heading" className="text-xl font-bold text-text">
            六艺总览
          </h2>
          <Link
            to="/arts"
            className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            查看全部六艺
          </Link>
        </div>
        <p className="mt-3 max-w-prose text-base leading-[1.7] text-text">
          六门基础动作门类，每门各含 10 个渐进难度动作。点开任意一门，即可查看它的十式进阶路径与分解指导。
        </p>

        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {arts.map((art) => (
            <li key={art.slug}>
              <ArtCard
                className="h-full"
                order={art.order}
                nameZh={art.nameZh}
                nameEn={art.nameEn}
                tagline={art.tagline}
                href={`/arts/${art.slug}`}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ③ 「如何开始」三步引导 */}
      <section aria-labelledby="home-start-heading" className="mt-10">
        <h2 id="home-start-heading" className="text-xl font-bold text-text">
          如何开始
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {START_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-md border border-border bg-surface p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-surface2 text-accent">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-sm text-muted">步骤 {index + 1}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-text">{step.title}</h3>
                <p className="mt-1.5 text-base leading-[1.7] text-text">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ④ 安全提示入口 */}
      <section aria-labelledby="home-safety-heading" className="mt-10">
        <h2 id="home-safety-heading" className="text-xl font-bold text-text">
          训练安全
        </h2>
        <div className="mt-4">
          <SafetyNotice text="训练前请充分热身，循序渐进、量力而行；动作过程中出现疼痛请立即停止，有伤病者请先咨询专业人士。" />
        </div>
      </section>

      {/* ⑤ 训练原则 / 关于（免责）入口 */}
      <section aria-labelledby="home-more-heading" className="mt-10">
        <h2 id="home-more-heading" className="text-xl font-bold text-text">
          继续了解
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/principles"
            className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <span className="min-w-0">
              <span className="block text-base font-semibold text-text">训练原则</span>
              <span className="mt-0.5 block text-sm text-muted">
                渐进、不练到力竭、组间休息等原书方法
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
          </Link>
          <Link
            to="/about"
            className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-accent"
          >
            <span className="min-w-0">
              <span className="block text-base font-semibold text-text">关于与免责声明</span>
              <span className="mt-0.5 block text-sm text-muted">
                内容来源、版权与医疗免责说明
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" />
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;
