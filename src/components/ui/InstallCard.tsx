/**
 * InstallCard —— 「安装到桌面 / 手机主屏」入口（PWA）。
 *
 * 为什么需要它：浏览器把「安装」这件事藏在地址栏的一个小图标里，
 * 不看一眼根本不知道本站可以当应用打开。这里把入口显式摆出来。
 *
 * 两种状态：
 * - 浏览器给出了 `beforeinstallprompt`（Chrome / Edge 且满足可安装条件）
 *   → 直接给一个按钮，点一下走浏览器原生的安装弹窗；
 * - 没给出（Firefox、iOS Safari、已经装过、或站点还没被判定可安装）
 *   → 给手动步骤。**不能因为拿不到事件就什么都不显示**，
 *     iOS 与 Firefox 上永远拿不到这个事件。
 *
 * 注意：这里**不判断**「是否已安装」来决定要不要渲染卡片 ——
 * 已安装时只把卡片内容换成一句确认，卡片本身保留，
 * 否则用户一旦装上就再也找不到「怎么卸载 / 怎么在别的设备上装」的说明。
 */
import { useEffect, useState } from 'react';
import { Download, MonitorDown, Share } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';

/**
 * `beforeinstallprompt` 事件（尚未进入 TS 的 DOM 类型定义，故自行声明）。
 * 只在 Chromium 系浏览器、且站点满足可安装条件时触发。
 */
interface BeforeInstallPromptEvent extends Event {
  /** 触发浏览器原生的安装弹窗 */
  prompt: () => Promise<void>;
  /** 用户在弹窗里的选择 */
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** 当前是否已经运行在「已安装」的应用窗口里（standalone / iOS 主屏） */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

/** 正文段落样式（与 About 页正文一致） */
const BODY_CLASS = 'text-base leading-[1.7] text-text';

/** 手动安装步骤的列表样式 */
const STEP_LIST_CLASS = 'mt-2 flex flex-col gap-2 text-base leading-[1.7] text-text';

/**
 * 安装入口卡片。挂在 `/about`。
 *
 * @example
 * <InstallCard />
 */
export function InstallCard() {
  /** 浏览器给出的安装事件（拿不到就是 null，走手动步骤） */
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  /** 是否已经处于已安装状态 */
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(detectStandalone());

    const onBeforeInstall = (event: Event) => {
      // 必须阻止默认行为，否则浏览器可能自行弹出自己的小提示条
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // 从浏览器标签页切到已安装窗口时同步状态
    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) setStandalone(true);
    };
    media.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  /** 走浏览器原生安装流程 */
  const handleInstall = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setStandalone(true);
    // 无论接受还是拒绝，事件都只能用一次，用完即弃
    setPromptEvent(null);
  };

  if (standalone) {
    return (
      <SectionCard id="install" title="安装到桌面 / 手机主屏">
        <p className={BODY_CLASS}>
          本站已经作为独立应用运行。
          <span className="text-muted">
            （在浏览器里打开时，可以在「关于」页这里随时把它装到桌面或手机主屏。）
          </span>
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard id="install" title="安装到桌面 / 手机主屏">
      <div className="flex flex-col gap-3">
        <p className={BODY_CLASS}>
          本站支持<b>安装为应用</b>：装好后会以独立窗口打开，不再有地址栏；
          应用外壳（页面、样式、60 式文字内容）会预先存在本地，
          <b>断网也能照常查阅</b>。翻看过的动作图同样会留下离线副本。
        </p>

        {promptEvent ? (
          <Button onClick={handleInstall} className="w-full sm:w-auto">
            <Download aria-hidden="true" className="h-4 w-4" />
            安装到桌面
          </Button>
        ) : (
          <div className="rounded-md border border-violet/25 bg-violet-soft p-3 sm:p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-text">
              <MonitorDown aria-hidden="true" className="h-4 w-4 shrink-0 text-violet" />
              手动安装
            </p>
            <ol className={STEP_LIST_CLASS}>
              <li className="flex gap-2">
                <span className="tnum shrink-0 font-semibold text-violet">1.</span>
                <span>
                  <b>Chrome / Edge（电脑）</b>：地址栏右侧的「安装」图标，
                  或右上角菜单 →「投放、保存和共享」→「安装页面为应用」
                </span>
              </li>
              <li className="flex gap-2">
                <span className="tnum shrink-0 font-semibold text-violet">2.</span>
                <span>
                  <b>Android Chrome</b>：右上角 ⋮ →「添加到主屏幕」/「安装应用」
                </span>
              </li>
              <li className="flex gap-2">
                <span className="tnum shrink-0 font-semibold text-violet">3.</span>
                <span className="flex flex-wrap items-baseline gap-1">
                  <b>iOS Safari</b>：底部分享
                  <Share aria-hidden="true" className="inline h-4 w-4 shrink-0 text-violet" />
                  按钮 →「添加到主屏幕」
                </span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default InstallCard;
