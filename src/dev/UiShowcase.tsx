/**
 * UiShowcase —— 通用组件视觉自检页（**dev-only**，架构 §5.6）。
 *
 * ⚠️ 本文件**不参与生产构建**：由 `src/App.tsx` 在 `import.meta.env.DEV` 守卫下动态挂载；
 * 生产构建会因常量折叠被完全剔除（验证：`dist/assets/*.js` 中不得出现 `UiShowcase` / `/dev/ui`）。
 *
 * 用途：把 T06 的**每个**组件连同各变体与边界态一次性渲染出来，供真实浏览器 + 无头截图
 * 目视核对（浅 / 深主题、375px 窄屏）。路由：`/dev/ui`。
 */
import { FigureSlot } from '@/components/ui/FigureSlot';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { StepList } from '@/components/ui/StepList';
import { InfoList } from '@/components/ui/InfoList';
import { SectionCard } from '@/components/ui/SectionCard';
import { ArtCard } from '@/components/ui/ArtCard';
import { MoveCard } from '@/components/ui/MoveCard';
import { ProgressionPath } from '@/components/ui/ProgressionPath';
import { PrevNextNav } from '@/components/ui/PrevNextNav';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { RiskNote } from '@/components/ui/RiskNote';
import { SafetyNotice } from '@/components/ui/SafetyNotice';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';
import type { ReactNode } from 'react';
import type { MoveDifficulty } from '@/types';

const DIFFICULTIES: MoveDifficulty[] = ['入门', '初级', '中级', '进阶', '高阶'];

const SAMPLE_STEPS = [
  '双手撑地，掌距略宽于肩，手指张开抓地',
  '收紧核心与臀部，头、背、髋、踝保持一条直线',
  '屈肘下放身体，肘部与躯干约呈 45° 夹角',
  '胸口接近地面时略作停顿',
  '推起还原，全程保持躯干刚性',
];

const PROGRESSION = Array.from({ length: 10 }, (_, i) => ({
  stepNo: i + 1,
  nameZh: `第 ${i + 1} 式`,
}));

/** 分区块标题 */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-border pb-2 text-lg font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function UiShowcase() {
  const { resolvedTheme } = useTheme();

  return (
    <main className="min-h-screen bg-bg p-4 text-text sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="rounded-md border border-border bg-surface p-4">
          <h1 className="text-xl font-semibold text-text">T06 通用组件展示页</h1>
          <p className="mt-1 text-sm text-muted">
            dev 工具页，不参与生产构建。当前主题：{resolvedTheme}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted">点此切换浅 / 深主题后重新核对</span>
          </div>
        </header>

        <Block title="FigureSlot 图位（3/4 · 3/2 · 1/1）">
          <div className="grid grid-cols-3 gap-3">
            <FigureSlot ratio="3/4" label="标准俯卧撑动作示意" />
            <FigureSlot ratio="3/2" label="标准俯卧撑动作示意" badge="第 5 式" />
            <FigureSlot ratio="1/1" label="标准俯卧撑动作示意" note="待补充" />
          </div>
          <p className="text-sm text-muted">
            三种比例固定高度一致；下方为窄容器（375px）内表现。
          </p>
          <div className="max-w-full overflow-x-auto">
            <div className="w-[375px] max-w-full">
              <FigureSlot ratio="3/2" label="窄容器图位" badge="第 5 式" />
            </div>
          </div>
          <p className="text-sm text-muted">
            传入 <code>src</code> 时渲染真实图片（示例用站点图标）：
          </p>
          <div className="w-24">
            <FigureSlot ratio="1/1" label="真实图片示例" src="/favicon.svg" />
          </div>
        </Block>

        <Block title="DifficultyBadge 难度徽章（五档）">
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <DifficultyBadge key={d} difficulty={d} />
            ))}
          </div>
        </Block>

        <Block title="StepList 分解步骤">
          <StepList steps={SAMPLE_STEPS} />
        </Block>

        <Block title="InfoList 要领 / 错误">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoList
              variant="success"
              items={['全程保持核心收紧', '肘部略向内收', '呼吸匀称不憋气']}
            />
            <InfoList
              variant="danger"
              items={['塌腰耸肩 —— 收紧核心下沉肩胛', '幅度不足 —— 胸口贴近地面']}
            />
          </div>
        </Block>

        <Block title="SectionCard 分块卡片">
          <SectionCard title="示例区块">
            <p className="text-base leading-relaxed text-text">
              「标签 + 内容」分块容器，用于统一页面节奏。
            </p>
          </SectionCard>
        </Block>

        <Block title="ArtCard 六艺卡片">
          <div className="grid gap-3 sm:grid-cols-2">
            <ArtCard
              slug="pushups"
              order={1}
              nameZh="俯卧撑"
              nameEn="Push-ups"
              tagline="上肢推力的根基，检验力量水平的黄金标准"
              href="/arts/pushups"
              progress={{ value: 4, total: 10 }}
              statusLabel="进行中"
              currentStepName="半俯卧撑"
            />
            <ArtCard
              slug="squats"
              order={2}
              nameZh="深蹲"
              nameEn="Squats"
              tagline="下肢力量的基石，撬动全身爆发力"
              href="/arts/squats"
              progress={{ value: 3, total: 10 }}
              statusLabel="进行中"
              currentStepName="支撑深蹲"
            />
            <ArtCard
              slug="pullups"
              order={3}
              nameZh="引体向上"
              nameEn="Pull-ups"
              tagline="背部与拉力的王者，单杠上的力量阶梯"
              href="/arts/pullups"
              progress={{ value: 10, total: 10 }}
              statusLabel="已完成"
            />
          </div>
        </Block>

        <Block title="MoveCard 招式卡片">
          <div className="flex flex-col gap-3">
            <MoveCard
              stepNo={5}
              nameZh="标准俯卧撑"
              nameEn="Full Push-ups"
              difficulty="中级"
              href="/arts/pushups/5"
            />
            <MoveCard
              stepNo={10}
              nameZh="单臂俯卧撑"
              nameEn="One-arm Push-up"
              difficulty="高阶"
              href="/arts/pushups/10"
            />
          </div>
        </Block>

        <Block title="ProgressionPath 进阶阶梯">
          <div className="flex flex-col gap-6">
            <ProgressionPath steps={PROGRESSION} currentStepNo={5} />
            <ProgressionPath steps={PROGRESSION} currentStepNo={1} />
          </div>
        </Block>

        <Block title="PrevNextNav 上/下一式（含 null 边界）">
          <div className="flex flex-col gap-4">
            <PrevNextNav
              prev={{ href: '/arts/pushups/4', label: '上斜俯卧撑' }}
              next={{ href: '/arts/pushups/6', label: '窄距俯卧撑' }}
            />
            <PrevNextNav prev={null} next={{ href: '/arts/pushups/2', label: '上斜俯卧撑' }} />
            <PrevNextNav prev={{ href: '/arts/pushups/9', label: '杠杆俯卧撑' }} next={null} />
          </div>
        </Block>

        <Block title="Breadcrumb 面包屑">
          <Breadcrumb
            items={[
              { label: '首页', href: '/' },
              { label: '六艺', href: '/arts' },
              { label: '俯卧撑', href: '/arts/pushups' },
              { label: '第 5 式' },
            ]}
          />
        </Block>

        <Block title="RiskNote 风险提示 / SafetyNotice 安全提示">
          <div className="flex flex-col gap-4">
            <RiskNote text="本式对肩颈压力较大，务必在保护或墙体支撑下练习，出现不适立即停止。" />
            <SafetyNotice text="训练前请充分热身，循序渐进，量力而行；伤病期间请咨询专业人士。" />
          </div>
        </Block>

        <Block title="Button 按钮">
          <div className="flex flex-wrap items-center gap-3">
            <Button to="/arts">浏览六艺</Button>
            <Button variant="secondary">次要按钮</Button>
            <Button variant="ghost">幽灵按钮</Button>
            <Button size="lg" variant="secondary">
              大号按钮
            </Button>
            <Button disabled>禁用态</Button>
          </div>
        </Block>
      </div>
    </main>
  );
}

export default UiShowcase;
