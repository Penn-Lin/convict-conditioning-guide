/**
 * Footer —— 全站页脚（架构 §2.5 / §9.5 / §9.7 · T07）。
 *
 * **常驻三块内容**（任何页面都渲染）：
 * ① 来源标注：内容基于 Paul Wade《囚徒健身》整理；
 * ② 免责声明：本站为健身科普与动作指导，非医疗建议；
 * ③ 版权 / 年份：© {年份} {站点名}。
 *
 * 另含**次要导航**（首页 / 六艺总览 / 训练原则 / 关于），站内跳转一律 `<Link>`。
 *
 * 可访问性：零硬编码色值（仅语义 token，浅 / 深主题自适应）；
 * 每个区块用 `<section aria-labelledby>` + 标题建立语义；链接触控目标 ≥ 44px。
 */
import { Link } from 'react-router-dom';
import { SITE_NAME } from '@/lib/constants';

/** 页脚次要导航项 */
interface FooterNavItem {
  to: string;
  label: string;
}

/** 次要导航配置 */
const FOOTER_NAV: readonly FooterNavItem[] = [
  { to: '/', label: '首页' },
  { to: '/arts', label: '六艺总览' },
  { to: '/principles', label: '训练原则' },
  { to: '/about', label: '关于' },
];

/** 区块小标题统一样式（不承载关键信息，可用 text-xs + muted） */
const SECTION_TITLE_CLASS = 'text-xs font-semibold tracking-wide text-muted';

/**
 * 页脚。
 *
 * @example
 * <Footer />
 */
export function Footer() {
  /** 版权年份（客户端渲染，取当前年） */
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* ① 来源标注 */}
          <section aria-labelledby="footer-source-heading">
            <h2 id="footer-source-heading" className={SECTION_TITLE_CLASS}>
              内容来源
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text">
              本站内容基于 Paul Wade 所著《囚徒健身》（Convict Conditioning）整理编写，
              仅用于动作要领的结构化整理与学习参考。
            </p>
          </section>

          {/* 次要导航 */}
          <nav aria-label="页脚导航" className="sm:text-right">
            <h2 className={SECTION_TITLE_CLASS}>快速导航</h2>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
              {FOOTER_NAV.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm text-text transition-colors hover:text-accent"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* ② 免责声明 */}
        <section
          aria-labelledby="footer-disclaimer-heading"
          className="mt-6 border-t border-border pt-6"
        >
          <h2 id="footer-disclaimer-heading" className={SECTION_TITLE_CLASS}>
            免责声明
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text">
            本站为健身科普与动作指导，非医疗建议。训练前请咨询专业人士，循序渐进、量力而行；
            如有伤病或身体不适，请遵医嘱。
          </p>
        </section>

        {/* ③ 版权 / 年份 */}
        <p className="mt-6 border-t border-border pt-6 text-xs text-muted">
          © {year} {SITE_NAME}。保留所有权利。
        </p>
      </div>
    </footer>
  );
}
