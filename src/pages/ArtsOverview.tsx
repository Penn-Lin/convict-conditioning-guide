/**
 * ArtsOverview —— 六艺总览页（架构 §4.1 / PRD §3.2 · P0-2 · T09）。
 *
 * 信息架构：
 * - 面包屑（首页 / 六艺）；
 * - H1「六艺总览」+ 引导语；
 * - **6 张六艺卡片**（`ArtCard`，封面图位 3/4）：数据来自 `@/data` 的 `arts`（已按原书顺序升序）；
 * - **推荐练习顺序说明**：从 `arts` 派生顺序，不硬编码任何艺名 / 路径。
 *
 * 约束：站内跳转一律 `<Link>`；移动优先网格（移动 1 列 / 平板 2 列 / 桌面 3×2）；
 * 颜色只走语义 token；正文 ≥16px、行高 ≥1.7。
 */
import { Link } from 'react-router-dom';
import { arts } from '@/data';
import { ArtCard } from '@/components/ui/ArtCard';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useDocumentMeta } from '@/lib/seo';
import { SITE_NAME } from '@/lib/constants';

export function ArtsOverview() {
  // 描述文案中的艺名由数据派生，避免在页面硬编码任何艺名（架构 §5.4.5 / 任务书要求）。
  const artNames = arts.map((art) => art.nameZh).join('、');
  useDocumentMeta(
    `六艺总览 · ${SITE_NAME}`,
    `《囚徒健身》六艺一览：${artNames}六门基础动作，每门十式渐进，含推荐练习顺序。`,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Breadcrumb items={[{ label: '首页', href: '/' }, { label: '六艺' }]} />

      <header className="mt-4">
        <h1 className="text-2xl font-bold leading-tight text-text sm:text-3xl">六艺总览</h1>
        <p className="mt-3 max-w-prose text-base leading-[1.7] text-text">
          六门基础动作门类，构成《囚徒健身》的核心体系。每门各含 10 个递进难度动作，点开任意一门，
          即可查看它的十式进阶路径与全部动作的分解指导。
        </p>
      </header>

      {/* 6 张六艺卡片（移动 1 列 / 平板 2 列 / 桌面 3×2） */}
      <section aria-labelledby="arts-grid-heading" className="mt-6">
        <h2 id="arts-grid-heading" className="text-xl font-bold text-text">
          六门艺
        </h2>
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

      {/* 推荐练习顺序说明（顺序由 `arts` 派生，不含硬编码艺名） */}
      <section aria-labelledby="arts-order-heading" className="mt-10">
        <h2 id="arts-order-heading" className="text-xl font-bold text-text">
          推荐练习顺序
        </h2>
        <p className="mt-3 max-w-prose text-base leading-[1.7] text-text">
          《囚徒健身》建议按原书顺序逐艺推进：先把一门艺从第 1 式练到第 10 式、达到其「进阶标准」后，
          再进入下一门。不追求同时推进多门，稳扎稳打更重要。
        </p>
        <ol className="mt-4 flex flex-col gap-3">
          {arts.map((art) => (
            <li key={art.slug} className="text-base leading-[1.7] text-text">
              <span className="mr-2 font-mono text-sm text-muted">{art.order}.</span>
              <Link
                to={`/arts/${art.slug}`}
                className="font-semibold text-accent underline-offset-2 hover:underline"
              >
                {art.nameZh}
              </Link>
              <span className="text-muted">（{art.nameEn}）— {art.tagline}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default ArtsOverview;
