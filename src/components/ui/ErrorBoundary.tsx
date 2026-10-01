/**
 * ErrorBoundary —— 渲染异常兜底（v3 补）。
 *
 * ## 为什么必须有
 * React 18 在渲染阶段抛异常时会**卸载整棵树** —— 表现就是用户看到的「整个页面变白」。
 * 全站此前没有任何错误边界，所以任何一处渲染异常（数据缺字段、`ladder` 越界、
 * 浏览器渲染引擎的偶发问题…）都会让页面彻底不可用，而且**用户拿不到任何可反馈的信息**。
 *
 * 这里做三件事：
 * 1. 不再白屏 —— 显示一张可读的错误卡，**导航栏仍在**，用户可以切去别的页；
 * 2. 把错误摘要摊开，并提供「复制详情」—— 用户能直接把原因发回来，不用靠猜；
 * 3. 路由变化时自动复位（由调用方用 `key={pathname}` 驱动），不必刷新整页。
 *
 * ## 覆盖范围（重要）
 * 错误边界**只捕获渲染 / 生命周期 / 构造函数里的异常**，捕获不到：
 * - 事件处理器里的抛错（React 不会把它们冒泡到边界）
 * - 异步回调（`Promise` / `setTimeout`）
 * 所以它不能替代定位真实 bug —— 它的价值是「把白屏换成一张能说清问题的卡片」。
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Copy, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 保留到控制台：开发者工具里能看到完整组件栈
    console.error('[ErrorBoundary] 渲染异常', error, info.componentStack);
  }

  private detail(): string {
    const { error } = this.state;
    if (!error) return '';
    return [
      `${error.name}: ${error.message}`,
      '',
      `页面：${window.location.href}`,
      `时间：${new Date().toISOString()}`,
      `UA：${navigator.userAgent}`,
      '',
      (error.stack ?? '').split('\n').slice(0, 12).join('\n'),
    ].join('\n');
  }

  private copy(): void {
    void navigator.clipboard?.writeText(this.detail());
  }

  private reload(): void {
    window.location.reload();
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-nav pt-5">
        <Section as="div" tone="risk" variant="outlined" icon={TriangleAlert} title="这个页面出了点问题">
          <p className="text-sm leading-[1.75] text-text">
            页面在渲染时遇到了异常，已经被拦下来了 —— 你的训练数据都在本地，没有丢。
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            可以先用底部导航切到别的页面继续用；如果这一页反复出问题，把下面的详情复制发给我。
          </p>

          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface2 p-3 font-mono text-[11px] leading-relaxed text-muted">
            {this.detail()}
          </pre>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" onClick={this.reload}>
              <RotateCw aria-hidden="true" className="h-4 w-4" />
              重新加载
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant="ghost"
              onClick={() => this.copy()}
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              复制错误详情
            </Button>
          </div>
        </Section>
      </div>
    );
  }
}
