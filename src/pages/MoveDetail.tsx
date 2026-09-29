/**
 * MoveDetail —— 十式详情页（路由 `/arts/:artSlug/:stepNo`，全站核心页 · T10）。
 *
 * 使用场景（PRD US-3）：训练中掏出手机，快速查「这一式怎么做、常见错误是什么」。
 * 因此以「手机上能否一眼看清」为第一标准：
 * - **首屏**即呈现：式名 + 难度 + 主图位 + 动作描述开头；
 * - **阅读顺序**（PRD §7.4）：面包屑 → 标题区 → 主图位 → 描述 → 风险提示（若有）
 *   → 页内锚点条 → 分解步骤 → 要领要点 → 常见错误 → 进阶标准 → 训练目标
 *   → 降阶方案 → 发力肌群 → 安全入口 → 上一式/下一式；
 * - **折叠策略**（PRD §7.4）：分解步骤 / 要领要点 / 常见错误 / 进阶标准**默认展开**
 *   （训练现场最高频），降阶方案 / 发力肌群**默认折叠**（次要信息）。
 *
 * 可访问性（架构 §9.7）：
 * - 折叠面板用 `<button aria-expanded aria-controls>` + `role="region" aria-labelledby`，
 *   键盘可达、`min-h-11`（≥44px）；
 * - 页内锚点条用原生 `<a href="#id">`（键盘可达、读屏可读）；
 * - 难度「文字 + 颜色」双通道（`DifficultyBadge`）；常见错误的「错误表现 / 纠正方法」
 *   用文字标签区分，**不靠颜色单独承载信息**；
 * - 零硬编码色值，全部语义 token；正文 ≥16px、行高 ≥1.7。
 *
 * 非法参数（架构 §4.1）：`artSlug` 不存在或 `stepNo` 非 1–10 / 越界 → 渲染与 404
 * **完全一致**的内容（复用 `NotFoundContent`），不白屏、不抛错。
 */
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, TriangleAlert } from 'lucide-react';

import { getMove } from '@/data';
import type { ResolvedMove } from '@/types';
import { parseStepNo } from '@/lib/slug';
import { buildMoveFigureLabel } from '@/lib/figureLabel';
import { useDocumentMeta } from '@/lib/seo';
import { SITE_NAME } from '@/lib/constants';

import { FigureSlot } from '@/components/ui/FigureSlot';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { StepList } from '@/components/ui/StepList';
import { InfoList } from '@/components/ui/InfoList';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PrevNextNav } from '@/components/ui/PrevNextNav';
import { RiskNote } from '@/components/ui/RiskNote';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import {
  NotFoundContent,
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_TITLE,
} from '@/pages/NotFound';

/* ---------------------------------------------------------------------------
 * 页内锚点（快速跳到「步骤 / 要领 / 错误 / 进阶标准」）
 * ------------------------------------------------------------------------ */

/** 页内锚点定义（`id` 必须在下方区块真实存在） */
const PAGE_ANCHORS: readonly { id: string; label: string }[] = [
  { id: 'steps', label: '步骤' },
  { id: 'key-points', label: '要领' },
  { id: 'mistakes', label: '错误' },
  { id: 'progression', label: '进阶标准' },
];

/* ---------------------------------------------------------------------------
 * 折叠面板（可访问实现）
 * ------------------------------------------------------------------------ */

/** `CollapsibleSection` 的 props */
interface CollapsibleSectionProps {
  /** 锚点 id（供页内跳转与 `aria-controls` 目标） */
  id: string;
  /** 对应数据字段名（写入 `data-field`，便于核对字段渲染） */
  field: string;
  /** 面板标题 */
  title: string;
  /** 是否默认展开 */
  defaultOpen?: boolean;
  /** 面板内容 */
  children: ReactNode;
}

/**
 * 可折叠区块 —— 采用**标准 disclosure 模式**：
 * 标题为 `<h2>`，内部 `<button>` 控制展开；面板 `role="region"` + `aria-labelledby`，
 * 收起时用 `hidden` 属性（元素仍存在，`aria-controls` 始终可解析）。
 */
function CollapsibleSection({
  id,
  field,
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      data-field={field}
      className="scroll-mt-20 rounded-md border border-border bg-surface"
    >
      <h2 className="m-0">
        <button
          type="button"
          id={headingId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-4 py-3 text-left"
        >
          <span className="text-lg font-semibold leading-snug text-text">
            {title}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={[
              'h-5 w-5 shrink-0 text-muted transition-transform',
              open ? 'rotate-180' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </button>
      </h2>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!open}
        className="px-4 pb-4"
      >
        {children}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * 常见错误：把「错误表现」与「纠正方法」视觉分离
 * ------------------------------------------------------------------------ */

/** 拆分结果 */
interface ParsedMistake {
  /** 错误表现 */
  mistake: string;
  /** 纠正方法（无分隔符时为 null） */
  fix: string | null;
}

/** 错误条目分隔符（数据格式固定为「错误表现 —— 纠正方法」，见 §9.5） */
const MISTAKE_SEPARATOR = '——';

/**
 * 把一条「错误表现 —— 纠正方法」拆成两段（纯函数）。
 *
 * @param item 原始条目
 * @returns `{ mistake, fix }`；无分隔符时 `fix` 为 `null`
 */
function splitMistake(item: string): ParsedMistake {
  const parts = item.split(MISTAKE_SEPARATOR);
  if (parts.length >= 2) {
    return {
      mistake: parts[0].trim(),
      fix: parts.slice(1).join(MISTAKE_SEPARATOR).trim(),
    };
  }
  return { mistake: item.trim(), fix: null };
}

/** 常见错误列表：每条分「错误表现（danger 标签）/ 纠正方法（success 标签）」两行 */
function MistakeList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item, index) => {
        const { mistake, fix } = splitMistake(item);
        return (
          <li key={index} className="flex items-start gap-2.5">
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-danger"
            />
            <div className="min-w-0">
              <p className="text-base leading-[1.7] text-text">
                <span className="font-semibold text-danger">错误表现：</span>
                {mistake}
              </p>
              {fix ? (
                <p className="mt-1 text-base leading-[1.7] text-text">
                  <span className="font-semibold text-success">纠正方法：</span>
                  {fix}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
 * 训练目标：三档并排（初级 → 中级 → 升阶）
 * ------------------------------------------------------------------------ */

/** 单档训练目标 */
interface GoalTier {
  /** 档位标签（如「初级」「中级」「升阶」） */
  label: string;
  /** 档位数值（如「2 组 × 25 次」「保持 1 分钟」） */
  value: string;
}

/** 分隔符（数据格式固定为「初级 A → 中级 B → 升阶 C」，见 §9.5） */
const GOAL_TIER_SEPARATOR = '→';

/**
 * 把 `trainingGoal` 拆成三档（纯函数）。
 * 形如 `初级 1 组 × 10 次 → 中级 2 组 × 25 次 → 升阶 3 组 × 50 次`
 * → `[{初级, 1 组 × 10 次}, {中级, 2 组 × 25 次}, {升阶, 3 组 × 50 次}]`。
 * 无法拆出 ≥2 档时返回空数组（调用方回退为整段文本）。
 *
 * @param goal 训练目标原文
 */
function parseGoalTiers(goal: string): GoalTier[] {
  const segments = goal
    .split(GOAL_TIER_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
  if (segments.length < 2) return [];

  return segments.map((segment) => {
    const matched = segment.match(/^(\S+)\s+(.*)$/);
    if (matched) {
      return { label: matched[1].trim(), value: matched[2].trim() };
    }
    return { label: '', value: segment };
  });
}

/** 训练目标：三档并排展示，一眼可辨三档差异 */
function TrainingGoalTiers({ goal }: { goal: string }) {
  const tiers = parseGoalTiers(goal);

  if (tiers.length === 0) {
    // 兜底：格式异常时整段展示，不丢内容
    return <p className="text-base leading-[1.8] text-text">{goal}</p>;
  }

  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
      {tiers.map((tier, index) => {
        const isLast = index === tiers.length - 1;
        return (
          <li
            key={`${tier.label}-${index}`}
            className={[
              'rounded-md border bg-surface2 p-3',
              // 末档（升阶 = 目标档）用 accent 描边强化，文字标签仍为主通道；
              // 描边不透明度 80% 以同时满足浅 / 深两主题下非文字对比度 ≥3:1（T13 修复）。
              isLast ? 'border-accent/80' : 'border-border',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {tier.label ? (
              <p className="text-xs font-medium text-muted">{tier.label}</p>
            ) : null}
            <p className="mt-1 text-sm font-semibold leading-snug text-text">
              {tier.value}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------------------
 * 主体内容（式存在时渲染）
 * ------------------------------------------------------------------------ */

/** `MoveArticle` 的 props */
interface MoveArticleProps {
  move: ResolvedMove;
}

/** 十式详情主体：渲染全部 13 个内容字段 + 图位 + 链路 + 安全入口 */
function MoveArticle({ move }: MoveArticleProps) {
  const { stepNo } = move;
  const art = move.artRef;
  const figureLabel = buildMoveFigureLabel(move);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {/* 面包屑：首页 / 六艺 / 艺 / 式 */}
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '六艺', href: '/arts' },
          { label: art.nameZh, href: `/arts/${art.slug}` },
          { label: `第 ${stepNo} 式 ${move.nameZh}` },
        ]}
      />

      {/* 标题区：所属艺 · 中文名 · 英文名 · 难度 · 序号 */}
      <header className="mt-4">
        <p data-field="artRef" className="text-xs font-medium text-muted">
          所属艺：{art.nameZh}（<span lang="en">{art.nameEn}</span>）
        </p>

        <h1
          data-field="nameZh"
          className="mt-1 text-2xl font-bold leading-tight text-text sm:text-3xl"
        >
          {move.nameZh}
        </h1>

        <p
          data-field="nameEn"
          lang="en"
          className="mt-1 font-mono text-sm leading-snug text-muted"
        >
          {move.nameEn}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span data-field="difficulty">
            <DifficultyBadge difficulty={move.difficulty} />
          </span>
          <span data-field="stepNo" className="font-mono text-sm text-muted">
            第 {stepNo} 式 / 共 10 式
          </span>
        </div>
      </header>

      {/* 主图位（ratio 3/2，单一图位，桌面限宽居中） */}
      <div className="mt-4">
        <FigureSlot
          ratio="3/2"
          label={figureLabel}
          badge={`第 ${stepNo} 式`}
          className="mx-auto max-w-[720px]"
        />
      </div>

      {/* 动作描述 */}
      <p
        data-field="description"
        className="mt-4 text-base leading-[1.8] text-text"
      >
        {move.description}
      </p>

      {/* 风险提示：仅高风险式（桥全系 / 倒立撑全系 / 各艺第 8–10 式）渲染 */}
      {move.riskNote ? <RiskNote className="mt-4" text={move.riskNote} /> : null}

      {/* 页内锚点条（吸顶）：快速跳到 步骤 / 要领 / 错误 / 进阶标准 */}
      <nav
        aria-label="页内快速跳转"
        className="sticky top-0 z-10 -mx-4 mt-4 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0">
          {PAGE_ANCHORS.map((anchor) => (
            <li key={anchor.id}>
              <a
                href={`#${anchor.id}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-medium text-accent hover:underline"
              >
                {anchor.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 分块内容（顺序 = PRD §7.4 阅读顺序） */}
      <div className="mt-4 flex flex-col gap-4">
        {/* 分解步骤（默认展开，置前） */}
        <CollapsibleSection id="steps" field="steps" title="分解步骤" defaultOpen>
          <StepList steps={move.steps} />
        </CollapsibleSection>

        {/* 要领要点（默认展开） */}
        <CollapsibleSection
          id="key-points"
          field="keyPoints"
          title="要领要点"
          defaultOpen
        >
          <InfoList variant="success" items={move.keyPoints} />
        </CollapsibleSection>

        {/* 常见错误（默认展开） */}
        <CollapsibleSection
          id="mistakes"
          field="commonMistakes"
          title="常见错误"
          defaultOpen
        >
          <MistakeList items={move.commonMistakes} />
        </CollapsibleSection>

        {/* 进阶标准（默认展开） */}
        <CollapsibleSection
          id="progression"
          field="progressionStandard"
          title="进阶标准"
          defaultOpen
        >
          <p className="rounded-md border-l-4 border-l-accent bg-surface2 p-3 text-base leading-[1.8] text-text">
            {move.progressionStandard}
          </p>
        </CollapsibleSection>

        {/* 训练目标（三档并排，常驻展开） */}
        <section
          id="training-goal"
          data-field="trainingGoal"
          className="rounded-md border border-border bg-surface p-4"
        >
          <h2 className="mb-3 text-lg font-semibold leading-snug text-text">
            训练目标
          </h2>
          <TrainingGoalTiers goal={move.trainingGoal} />
        </section>

        {/* 降阶方案（默认折叠） */}
        <CollapsibleSection id="regression" field="regression" title="降阶方案">
          <p className="text-base leading-[1.8] text-text">{move.regression}</p>
        </CollapsibleSection>

        {/* 主要发力肌群（默认折叠） */}
        <CollapsibleSection id="muscles" field="muscles" title="主要发力肌群">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {move.muscles.map((muscle) => (
              <li
                key={muscle}
                className="rounded border border-border bg-surface2 px-2.5 py-1 text-sm text-text"
              >
                {muscle}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      </div>

      {/* 安全入口：一键跳转训练原则（PRD P0-7） */}
      <SafetyNotice
        className="mt-6"
        text="训练前请充分热身、循序渐进、量力而行；出现疼痛立即停止。有伤病或身体不适者请先咨询医生。"
      />

      {/* 上一式 / 下一式（正确处理 null 边界） */}
      <div className="mt-6">
        <PrevNextNav
          prev={
            move.prevStep
              ? { href: move.prevStep.href, label: move.prevStep.nameZh }
              : null
          }
          next={
            move.nextStep
              ? { href: move.nextStep.href, label: move.nextStep.nameZh }
              : null
          }
        />
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * 路由组件
 * ------------------------------------------------------------------------ */

/**
 * 十式详情页（路由组件）。
 *
 * - 安全解析 URL 参数（`stepNo` 为字符串，经 `parseStepNo` 校验 1–10）；
 * - 式不存在（非法 artSlug / stepNo 越界）→ 渲染与 404 一致的内容。
 */
export function MoveDetail() {
  const { artSlug, stepNo: rawStepNo } = useParams<{
    artSlug: string;
    stepNo: string;
  }>();

  const parsedStepNo = parseStepNo(rawStepNo);
  const move =
    artSlug && parsedStepNo !== undefined
      ? getMove(artSlug, parsedStepNo)
      : undefined;

  // 无条件调用（hooks 规则）；非法参数时写入与 404 页一致的 meta。
  useDocumentMeta(
    move
      ? `${move.nameZh} · 第 ${move.stepNo} 式 · ${move.artRef.nameZh} · ${SITE_NAME}`
      : NOT_FOUND_TITLE,
    move ? move.description : NOT_FOUND_DESCRIPTION,
  );

  // 非法参数：渲染与 404 完全一致的内容（不白屏、不抛错）
  if (!move) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <NotFoundContent />
      </main>
    );
  }

  return <MoveArticle move={move} />;
}

export default MoveDetail;
