/**
 * MoveDetail —— 十式详情页（路由 `/arts/:artSlug/:stepNo`，全站核心页）。
 *
 * 使用场景：训练中掏出手机，快速查「这一式怎么做」，并**打卡确认进阶条件**。
 *
 * v2 阅读顺序（相对 v1 的两处关键调整）：
 * - **紧凑图位条**替代 v1 的 250px 高空灰框 —— 首屏还给标题与打卡卡；
 * - **进阶条件卡上提到「动作描述之后、分块内容之前」** —— v1 的进阶标准埋在页面最底部，
 *   而它恰恰是用户最需要操作的部分。现在它紧跟描述，勾完再往下看细节。
 *
 * 可访问性：折叠面板用 `<button aria-expanded aria-controls>` + `role="region"`；
 * 页内锚点用原生 `<a href="#id">`；难度「文字 + 颜色」双通道；正文 ≥16px / 行高 ≥1.7。
 */
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  LifeBuoy,
  ListOrdered,
  Target,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@/lib/tones';
import { toneStyle } from '@/lib/tones';

import { getMove } from '@/data';
import type { ResolvedMove } from '@/types';
import { parseStepNo } from '@/lib/slug';
import { buildMoveFigureLabel } from '@/lib/figureLabel';
import { useDocumentMeta } from '@/lib/seo';
import { SITE_NAME } from '@/lib/constants';
import { artTheme } from '@/lib/artTheme';
import { useTraining } from '@/hooks/TrainingProvider';

import { FigureSlot } from '@/components/ui/FigureSlot';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { StepList } from '@/components/ui/StepList';
import { InfoList } from '@/components/ui/InfoList';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PrevNextNav } from '@/components/ui/PrevNextNav';
import { RiskNote } from '@/components/ui/RiskNote';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { RichText, HighlightLegend } from '@/components/ui/RichText';
import { SemanticNote } from '@/components/ui/Card';
import { StepProgressCard } from '@/components/ui/StepProgressCard';
import { Button } from '@/components/ui/Button';
import {
  NotFoundContent,
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_TITLE,
} from '@/pages/NotFound';

/* ---------------------------------------------------------------------------
 * 页内锚点
 * ------------------------------------------------------------------------ */

const PAGE_ANCHORS: readonly { id: string; label: string }[] = [
  { id: 'steps', label: '步骤' },
  { id: 'key-points', label: '要领' },
  { id: 'mistakes', label: '错误' },
  { id: 'training-goal', label: '目标' },
  { id: 'regression', label: '降阶' },
];

/* ---------------------------------------------------------------------------
 * 折叠面板
 * ------------------------------------------------------------------------ */

interface CollapsibleSectionProps {
  id: string;
  field: string;
  title: string;
  defaultOpen?: boolean;
  /** 模块色调（见 lib/tones.ts）：不同板块用不同色相与外框区分 */
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
}

function CollapsibleSection({
  id,
  field,
  title,
  defaultOpen = false,
  tone = 'neutral',
  icon: Icon,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${id}-panel`;
  const headingId = `${id}-heading`;
  const style = toneStyle(tone);

  return (
    <section
      id={id}
      data-field={field}
      className={[
        'scroll-mt-24 overflow-hidden rounded-lg border bg-surface shadow-card',
        style.border,
      ].join(' ')}
    >
      <h2 className="m-0">
        <button
          type="button"
          id={headingId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-h-[56px] w-full items-center gap-2.5 px-4 py-3 text-left"
        >
          {Icon ? (
            <span
              aria-hidden="true"
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                style.chip,
              ].join(' ')}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <span className="min-w-0 flex-1 text-base font-bold leading-snug text-text">
            {title}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={[
              'h-5 w-5 shrink-0 text-muted transition-transform duration-200',
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
 * 常见错误
 * ------------------------------------------------------------------------ */

const MISTAKE_SEPARATOR = '——';

function splitMistake(item: string): { mistake: string; fix: string | null } {
  const parts = item.split(MISTAKE_SEPARATOR);
  if (parts.length >= 2) {
    return {
      mistake: parts[0].trim(),
      fix: parts.slice(1).join(MISTAKE_SEPARATOR).trim(),
    };
  }
  return { mistake: item.trim(), fix: null };
}

/** 常见错误：错误表现（红块）/ 纠正方法（绿块）分块呈现，双击通道（标签文字 + 颜色） */
function MistakeList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item, index) => {
        const { mistake, fix } = splitMistake(item);
        return (
          <li key={index} className="flex flex-col gap-2">
            <SemanticNote
              tone="risk"
              title="错误表现"
              icon={
                <TriangleAlert aria-hidden="true" className="h-4 w-4 text-danger" />
              }
            >
              <RichText className="text-base leading-[1.7] text-text" text={mistake} />
            </SemanticNote>
            {fix ? (
              <SemanticNote
                tone="good"
                title="纠正方法"
                icon={<Target aria-hidden="true" className="h-4 w-4 text-success" />}
              >
                <RichText className="text-base leading-[1.7] text-text" text={fix} />
              </SemanticNote>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
 * 训练目标三档
 * ------------------------------------------------------------------------ */

interface GoalTier {
  label: string;
  value: string;
}

const GOAL_TIER_SEPARATOR = '→';

/** 把 `trainingGoal` 拆成三档（纯函数） */
function parseGoalTiers(goal: string): GoalTier[] {
  const segments = goal
    .split(GOAL_TIER_SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '');
  if (segments.length < 2) return [];

  return segments.map((segment) => {
    const matched = segment.match(/^(\S+)\s+(.*)$/);
    if (matched) return { label: matched[1].trim(), value: matched[2].trim() };
    return { label: '', value: segment };
  });
}

/**
 * 训练目标三档。
 *
 * 这三档**同时就是训练量阶梯**（初级 → 中级 → 升阶），
 * 计划引擎的 `volumeLadder` 就是从这里派生的 —— 所以这里用递进视觉，
 * 而不是三个等权重的格子。
 */
function TrainingGoalTiers({ goal }: { goal: string }) {
  const tiers = parseGoalTiers(goal);

  if (tiers.length === 0) {
    return <RichText className="text-base leading-[1.8] text-text" text={goal} />;
  }

  const currentTier = 1; // 第 2 档（中级）为「计划引擎默认使用的档位」

  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-2.5 p-0">
      {tiers.map((tier, index) => {
        const isCurrent = index === currentTier;
        return (
          <li
            key={`${tier.label}-${index}`}
            className={[
              'flex items-center gap-3 rounded-md border p-3',
              isCurrent ? 'border-accent/40 bg-accent-soft' : 'border-border bg-surface2',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-pill text-xs font-bold',
                isCurrent ? 'bg-accent text-bg' : 'bg-border text-muted',
              ].join(' ')}
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-xs font-bold text-muted">{tier.label}</span>
                {isCurrent ? (
                  <span className="rounded-pill bg-accent px-1.5 py-px text-[10px] font-bold text-bg">
                    当前档位
                  </span>
                ) : null}
              </span>
              <RichText
                className="mt-0.5 block text-base font-semibold leading-snug text-text"
                text={tier.value}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------------------
 * 主体
 * ------------------------------------------------------------------------ */

function MoveArticle({ move }: { move: ResolvedMove }) {
  const { stepNo } = move;
  const art = move.artRef;
  const theme = artTheme(art.slug);
  const figureLabel = buildMoveFigureLabel(move);

  const training = useTraining();
  const goals = training.goalsOf(art.slug, stepNo);
  const checks = training.store.skills[art.slug].checks[stepNo];
  const completed = training.store.skills[art.slug].completedSteps.includes(stepNo);
  const checkedCount = checks?.slice(0, goals.length).filter(Boolean).length ?? 0;
  const allChecked = goals.length > 0 && checkedCount === goals.length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-nav-cta pt-5 sm:px-6">
      <Breadcrumb
        items={[
          { label: '首页', href: '/' },
          { label: '六艺', href: '/arts' },
          { label: art.nameZh, href: `/arts/${art.slug}` },
          { label: `第 ${stepNo} 式` },
        ]}
      />

      {/* 标题区 */}
      <header className="mt-3">
        <div className="flex items-center gap-2">
          <span
            className={[
              'tnum flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold',
              theme.solid,
            ].join(' ')}
          >
            {stepNo}
          </span>
          <p data-field="artRef" className="min-w-0 truncate text-sm font-medium text-muted">
            {art.nameZh} · 第 {stepNo} 式 / 共 10 式
          </p>
        </div>

        <h1
          data-field="nameZh"
          className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight text-text sm:text-3xl"
        >
          {move.nameZh}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <DifficultyBadge difficulty={move.difficulty} />
          <span
            data-field="nameEn"
            lang="en"
            className="font-mono text-xs text-subtle"
          >
            {move.nameEn}
          </span>
        </div>
      </header>

      {/* 紧凑图位条（v2：替代 v1 的 250px 高空灰框） */}
      <div className="mt-4">
        <FigureSlot
          variant="strip"
          ratio="3/2"
          label={figureLabel}
          badge={`第 ${stepNo} 式`}
        />
      </div>

      {/* 动作描述（富文本高亮） */}
      <section aria-labelledby="description-heading" className="mt-4">
        <h2 id="description-heading" className="sr-only">
          动作描述
        </h2>
        <RichText
          className="text-base leading-[1.8] text-text"
          text={move.description}
        />
        <HighlightLegend className="mt-3" />
      </section>

      {/* 风险提示 */}
      {move.riskNote ? (
        <RiskNote className="mt-4" text={move.riskNote} />
      ) : null}

      {/* 进阶条件打卡（核心交互，前置到细节之前） */}
      <StepProgressCard
        className="mt-6"
        artName={art.nameZh}
        stepNo={stepNo}
        goals={goals}
        checks={checks}
        completed={completed}
        nextStepName={move.nextStep?.nameZh ?? null}
        onToggle={(index) => training.toggleStepCheck(art.slug, stepNo, index)}
        onComplete={() => training.completeStep(art.slug, stepNo)}
        onUndo={() => training.undoStep(art.slug, stepNo)}
      />

      {/* 页内锚点条（吸顶） */}
      <nav
        aria-label="页内快速跳转"
        className="sticky top-0 z-10 -mx-4 mt-6 border-b border-border bg-bg/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
      >
        <ul className="m-0 flex list-none flex-nowrap items-center gap-x-1 overflow-x-auto p-0 scroll-x">
          {PAGE_ANCHORS.map((anchor) => (
            <li key={anchor.id} className="shrink-0">
              <a
                href={`#${anchor.id}`}
                className="inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-muted transition-colors hover:text-accent"
              >
                {anchor.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 flex flex-col gap-3.5">
        <CollapsibleSection
          id="steps"
          field="steps"
          title="分解步骤"
          tone="data"
          icon={ListOrdered}
          defaultOpen
        >
          <StepList
            steps={move.steps}
            hueSoftClass={theme.soft}
            hueTextClass={theme.text}
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="key-points"
          field="keyPoints"
          title="要领要点"
          tone="body"
          icon={CheckCircle2}
          defaultOpen
        >
          <InfoList variant="success" items={move.keyPoints} />
        </CollapsibleSection>

        <CollapsibleSection
          id="mistakes"
          field="commonMistakes"
          title="常见错误"
          tone="risk"
          icon={TriangleAlert}
          defaultOpen
        >
          <MistakeList items={move.commonMistakes} />
        </CollapsibleSection>

        <CollapsibleSection
          id="progression"
          field="progressionStandard"
          title="进阶标准原文"
          tone="neutral"
          icon={Target}
        >
          <SemanticNote tone="info">
            <RichText
              className="text-base leading-[1.8] text-text"
              text={move.progressionStandard}
            />
          </SemanticNote>
        </CollapsibleSection>

        {/* 训练目标（常驻展开 · 行动语义） */}
        <section
          id="training-goal"
          data-field="trainingGoal"
          className="scroll-mt-24 overflow-hidden rounded-lg border border-accent/40 bg-surface shadow-card"
        >
          <header className="flex items-center gap-2.5 border-b border-accent/40 px-4 py-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-bg"
            >
              <Target className="h-4 w-4" />
            </span>
            <h2 className="flex-1 text-base font-bold leading-snug text-text">训练目标</h2>
          </header>
          <div className="p-4">
            <p className="mb-3 text-sm leading-relaxed text-muted">
              同一式内的训练量三档 —— 先把量练满，再考虑进入下一式。
            </p>
            <TrainingGoalTiers goal={move.trainingGoal} />
          </div>
        </section>

        <CollapsibleSection
          id="regression"
          field="regression"
          title="太难了怎么办（降阶方案）"
          tone="guide"
          icon={LifeBuoy}
        >
          <RichText
            className="text-base leading-[1.8] text-text"
            text={move.regression}
          />
        </CollapsibleSection>

        <CollapsibleSection
          id="muscles"
          field="muscles"
          title="主要发力肌群"
          tone="neutral"
          icon={Dumbbell}
        >
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {move.muscles.map((muscle) => (
              <li
                key={muscle}
                className="rounded-pill border border-border bg-surface2 px-3 py-1 text-sm text-text"
              >
                {muscle}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      </div>

      <SafetyNotice
        className="mt-6"
        text="训练前请充分热身、循序渐进、量力而行；出现疼痛立即停止。有伤病或身体不适者请先咨询医生。"
      />

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

      {/* 吸底常驻进度条 CTA */}
      <div className="pb-safe fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 border-t border-border bg-bg/95 shadow-lift backdrop-blur-md md:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {art.nameZh} · 第 {stepNo} 式 {move.nameZh}
            </p>
            <p
              className={[
                'tnum text-sm font-bold',
                allChecked || completed ? 'text-success' : 'text-text',
              ].join(' ')}
            >
              {completed
                ? '本式已完成'
                : `进阶条件 ${checkedCount}/${goals.length}`}
            </p>
          </div>

          {completed && move.nextStep ? (
            <Button to={move.nextStep.href}>
              下一式
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          ) : (
            // 原生锚点：跳到下方的打卡卡（不改变路由）
            <a
              href="#progression-check"
              className="inline-flex min-h-[46px] items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold text-text"
            >
              去打卡
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * 路由组件
 * ------------------------------------------------------------------------ */

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

  useDocumentMeta(
    move
      ? `${move.nameZh} · 第 ${move.stepNo} 式 · ${move.artRef.nameZh} · ${SITE_NAME}`
      : NOT_FOUND_TITLE,
    move ? move.description : NOT_FOUND_DESCRIPTION,
  );

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
