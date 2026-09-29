# 可访问性与可读性量化验收报告（T13 · P0-16）

> 验收人：QA 工程师 严过关（Edward）
> 日期：2026-09-29
> 被测对象：`D:/code/WorkBoddy/囚徒健身` · **生产产物**（`npm run build` → `vite preview` @ `http://localhost:4173`）
> 构建产物：`dist/`（vite 5.4.21，1607 modules，`index-6bJfvBY6.js` / `index-Dk09YanH.css`，sitemap 70 条）
> 结论一句话：**除「浅色主题难度徽章对比度」与「4 处独立触控目标 < 44×44」外，其余可访问性指标全部达标；Lighthouse Accessibility 全员 ≥ 96（达 ≥95 线），故 P0-16 判为「有条件达标」——需工程修复 1 个 serious 缺陷后方为完全达标。**

---

## 0. 测量方法与工具（可复现）

| 手段 | 工具 / 版本 | 说明 |
|---|---|---|
| Lighthouse Accessibility | **Lighthouse 13.5.0**（`npx --yes lighthouse`，按需下载，**未写入 `package.json`**） | 移动端仿真 375×812 / DPR2 / form-factor=mobile，`--only-categories=accessibility` |
| 自动化可访问性规则 | **axe-core 4.10.2**（经 CDN 注入，运行于 `wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice` 标签） | 浅 + 深两主题各跑 6 页 |
| 对比度 / 字号 / 行高 / 触控 | **自写 CDP 脚本**（Chrome 153 headless，`Runtime.evaluate` 取 `getComputedStyle` 逐元素实算） | 非文字通道经 `getComputedStyle().color` / `borderColor` 实算，非读 CSS 源码推断 |
| 键盘走查 | **CDP `Input.dispatchKeyEvent`**（真实 keyDown/keyUp，仅键盘） | 记录 activeElement、`:focus-visible` 实算 box-shadow、`aria-expanded` |
| 媒体特性 | **CDP `Emulation.setEmulatedMedia`** | 模拟 `prefers-reduced-motion: reduce` |
| 视口 | **CDP `Emulation.setDeviceMetricsOverride`** | 375×812（移动）、1280×900（桌面行宽） |

**测试页面**：`/`、`/arts`、`/arts/pushups`、`/arts/pushups/5`、`/principles`、`/about`（6 页）+ 16 个式页抽查。
**所有数值均为浏览器实测**；无「目测」结论。**未发现测试代码自身的断言错误。**

> 说明：本机另有工程师并行修改 `pullups.ts` / `handstandPushups.ts` / `bridges.ts` 文案，本次构建与测试期间未见 `dist` 竞争失败，结果有效。

---

## A. Lighthouse Accessibility（移动端）

| 页面 | Accessibility 分数 | 是否 ≥ 95 |
|---|---|---|
| `/`（首页） | **100** | ✅ |
| `/arts`（六艺总览） | **100** | ✅ |
| `/arts/pushups`（六艺详情） | **96** | ✅ |
| `/arts/pushups/5`（十式详情） | **96** | ✅ |
| `/principles`（训练原则） | **100** | ✅ |
| `/about`（关于） | **100** | ✅ |

- **来源**：Lighthouse 13.5.0 真实跑分（非替代方案）。
- **失败审计**：仅 `/arts/pushups` 与 `/arts/pushups/5` 各命中 `color-contrast`（权重 7，score=0）——即下方 §B 的难度徽章对比度问题；其余页面无失败审计。
- **判定：达标**（`≥ 95` 线，最低 96）。注：**若无该对比度缺陷，六页均可为 100**。

---

## B. 对比度实测（浅 / 深两主题，逐元素实算）

### B.1 浅色主题（默认）

| 类别 | 实测最小值 | 目标 | 判定 |
|---|---|---|---|
| 正文文字（非大字号） | **4.13 : 1** | ≥ 4.5 | ❌ **不达标** |
| 大字号文字（≥24px 或 ≥18.66px 粗体） | **15.92 : 1** | ≥ 3 | ✅ |
| 图标（非文字） | **4.57 : 1** | ≥ 3 | ✅ |
| 语义色边框（非文字） | **1.75 : 1** | ≥ 3（见备注） | ⚠️ 见 §B.3 |

**不达标明细（浅色主题）** —— 均为 **难度徽章**（`DifficultyBadge`，`bg-lv-X/10` 浅色底 + 同色文字）：

| 元素（选择器） | 文색 / 底色（实测） | 实测对比度 | 期望 | 页面 |
|---|---|---|---|---|
| `span.border-lv-1/40.bg-lv-1/10.text-lv-1`（"入门"） | `#15803D` / `#E0ECE7` | **4.13** | ≥4.5 | `/arts/pushups`（2 处） |
| `span.border-lv-3/40.bg-lv-3/10.text-lv-3`（"中级"） | `#B45309` / `#F0E8E2` | **4.13** | ≥4.5 | `/arts/pushups`（2 处） |
| `span.border-lv-3/40.bg-lv-3/10.text-lv-3`（"中级"） | `#B45309` / `#F8EEE6` | **4.39** | ≥4.5 | `/arts/pushups/5`（1 处） |
| `span.border-lv-4/40.bg-lv-4/10.text-lv-4`（"进阶"） | `#C2410C` / `#F2E6E2` | **4.23** | ≥4.5 | `/arts/pushups`（2 处） |

> 「初级 `lv-2`（#1D4ED8）」「高阶 `lv-5`（#B91C1C）」两档实测 ≥4.5，达标。**根因**：徽章叠加了 `bg-lv-X/10` 的同色 10% 浅底，使有效背景从纯白变为浅色，把原本"白底 ≥4.5"的等级色拉低至 4.13–4.39。**两套独立工具（Lighthouse `color-contrast`、axe-core `color-contrast[serious]`）均复现同一结果。**

### B.2 深色主题

| 类别 | 实测最小值 | 目标 | 判定 |
|---|---|---|---|
| 正文文字 | **5.56 : 1** | ≥ 4.5 | ✅ |
| 大字号文字 | **15.99 : 1** | ≥ 3 | ✅ |
| 图标（非文字） | **5.95 : 1** | ≥ 3 | ✅ |

- **深色主题正文 0 处不达标**；axe-core 在深色主题下 **无** `color-contrast` 违规。
- 深色通过写入 `localStorage['theme'] = JSON.stringify('dark')`（即 `"dark"`）+ 冷加载切换，已确认 `document.documentElement.classList.contains('dark') === true` 后测量。

### B.3 非文字关键元素（语义色描边）—— 判定说明

实测：难度徽章描边 `border-lv-X/40`、免责/风险块描边 `border-danger/40`、训练目标末档 `border-accent/50` 的对比度为 **1.75–2.15 : 1**（浅）/ **2.03–2.72 : 1**（深），**低于 PRD §9.1 / §9.7.2 字面的「边框等非文字元素 ≥3:1」**。

**判定：⚠️ 条件性不达标（交 team-lead 裁定）**。理由：WCAG 1.4.11（非文字对比度）仅约束"识别组件/状态所必需"的视觉信息；上述描边均为**装饰性强化**——信息已由「文字标签 + 图标形状 + 加粗标题」独立承载，故不构成 WCAG 违规。但 PRD §9.7.2 **明文举例**「安全提示块描边」须 ≥3:1，故从 PRD 字面角度应记为偏差。**聚焦的对比度问题仍是 §B.1 的徽章文字。**

---

## C. 移动端（375px）字号 / 行高 / 触控 / 行宽

### C.1 正文字号 ✅

- 全局 `body` 计算字号 = **16px**；所有正文段落（描述 / 步骤 / 要领 / 错误 / 原则 / 关于）均为 **16px**。
- 可见文字元素字号分布（浅色，全 6 页）：`12px×124、14px×99、16px×165、18px×20、20px×6、24px×5、30px×1`。
- **分类核查**：**12px** 全部为 Caption/元信息（英文名 `Push-ups`、"第 N 艺/式"角标、序号、页脚小标题、© 版权、训练目标档位标签）；**14px** 全部为 UI 标签/次要文字（导航链接、面包屑、锚点条、肌肉标签、按钮文案、页脚法务段）。**未发现以 <16px 承载"正文段落"的情况。**
- **判定：达标**（正文 ≥16px；12–13px 仅用于不承载关键信息的元信息）。
- 备注（非阻塞）：14px 中「训练目标档位数值（如 `1 组 × 5 次`）」「上一/下一式名称」偏关键信息，建议后续可提升至 16px，但**不属于本次判定项**。

### C.2 正文行高

- 全局 `body` 行高 = 27.2px ÷ 16px = **1.70** ✅。
- 多数段落使用 `leading-[1.7]`（1.70）/ `leading-[1.8]`（1.80）✅。
- ❌ **StepList（分解步骤）与 InfoList（要领要点）条目使用 `leading-relaxed` = 1.625**，低于 1.7：

| 元素 | 选择器 | 实测行高比 | 期望 | 涉及 |
|---|---|---|---|---|
| 分解步骤正文 | `ol > li > span.pt-1.text-base.leading-relaxed` | **1.625** | ≥1.70 | 60 式详情页的每个步骤 |
| 要领要点条目 | `ul > li > span.text-base.leading-relaxed` | **1.625** | ≥1.70 | 60 式详情页的每条要领 |

- **判定：⚠️ 轻微不达标**（正文行高总体达标，仅上述两处列表正文为 1.625）。

### C.3 触控目标（375px）—— **不达标清单**

统计：可交互元素 **115** 个，其中 `< 44×44` 的 **38** 个。按可豁免性分为两组：

**（1）独立交互元素（不可豁免，必须 ≥44×44）—— 4 类，不达标：**

| # | 元素 | 选择器 | 实测尺寸 | 期望 | 出现页面 | 源码位置 |
|---|---|---|---|---|---|---|
| 1 | 站名 Logo 链接 | `header a[aria-label="囚徒健身 · 六艺十式动作指导站"]` | **62.4 × 24** | ≥44×44 | 全部 6 页 | `src/components/layout/Header.tsx:76-86` |
| 2 | 页脚导航「首页」 | `footer nav[aria-label="页脚导航"] a`（"首页"） | **28 × 44** | ≥44×44 | 全部 6 页 | `src/components/layout/Footer.tsx:65-70` |
| 3 | 页脚导航「关于」 | `footer nav[aria-label="页脚导航"] a`（"关于"） | **28 × 44** | ≥44×44 | 全部 6 页 | `src/components/layout/Footer.tsx:65-70` |
| 4 | 式页锚点条「步骤 / 要领 / 错误」 | `main nav[aria-label="页内快速跳转"] a` | **28 × 44** | ≥44×44 | `/arts/*/[1-10]` | `src/pages/MoveDetail.tsx:362-370` |
| 5 | 安全提示块「查看训练原则」链接 | `aside[role="note"] a`（"查看训练原则"） | **84 × 20** | ≥44×44 | `/`、`/arts/*/[1-10]` | `src/components/ui/SafetyNotice.tsx:56-61` |

> 注：#2/#3 高度已达 44px（`min-h-11`）但**宽度仅 28px**（2 字文案）；#1 宽度达标而高度仅 24px；#5 `inline-flex` 无 `min-h`，高度仅 20px。**「六艺总览 / 训练原则」（4 字，56×44）与锚点「进阶标准」（56×44）已达标。**

**（2）行内文本链接（适用 WCAG 2.5.8 行内链接例外，不判失败）：**
面包屑（`首页/六艺/俯卧撑`，28–42×20）、正文内链（`俯卧撑/深蹲…`、`浏览六艺总览`、`查看完整免责声明` 等，16–128×20）。

- **判定：⚠️ 不达标**（5 处独立触控目标 < 44×44）。

### C.4 桌面（1280px）正文行宽

| 页面 | 最宽正文段落实测 | 目标 | 判定 |
|---|---|---|---|
| `/principles` | **≈ 70.2 字符**（736px） | 70–80 | ✅ |
| `/about` | **≈ 70.2 字符**（736px） | 70–80 | ✅ |
| `/arts/pushups/5` | **≈ 68.7 字符**（720px） | 70–80 | ✅ |
| `/`（卡片内正文） | ≈ 64.5 字符 | 70–80 | ✅ |

- 正文容器 `max-w-3xl` / `max-w-5xl` + `max-w-prose(72ch)` 约束生效，**最长正文行 ≤ ~70 字符，落在 70–80 目标带内**。**判定：达标。**
- 备注：`/` 上「安全提示」标题行的 88 字符估算属**标题行（flex 图标+标题）**，非连续正文，不计入行宽。

### C.5 横向溢出（上下文）

375px 下 6 页 `scrollWidth == clientWidth == 375`，**0 横向溢出**（复测确认）。

---

## D. 纯键盘走查（仅 Tab / Enter / Space，不碰鼠标）

页面：`/`、`/arts/pushups/5`、`/principles`。

| 检查项 | 结果 | 证据 |
|---|---|---|
| **Tab 顺序合理** | ✅ | `/`：免责条链接 → 关闭按钮 → 站名 → 主题切换 → 汉堡 → 主内容（顺序与视觉/DOM 一致；免责条在 Header 之上，符合 `AppLayout` 布局） |
| **焦点环可见** | ✅ | 3 页共 42 个 Tab 停靠点，**`focus-visible` 缺失 = 0**；每个停靠点实算 `box-shadow` 均非 `none`（`ring-2 ring-accent`） |
| **汉堡菜单键盘开合** | ✅ | Enter：`aria-expanded` `false → true`（面板 `hidden` 移除）→ `false`；`aria-label` 随态切换 |
| **折叠面板键盘开合** | ✅ | 「降阶方案」Enter：`aria-expanded false→true` 且 `hidden true→false`；Space：再切回 |
| **主题切换键盘触发** | ✅ | Enter：`<html class="dark">` 由 false→true，按钮 `aria-label` 「切换到深色主题」→「切换到浅色主题」 |
| **免责提示条关闭键盘触发** | ✅ | Enter：`<aside>` 从 DOM 移除，`localStorage['disclaimer-dismissed']='true'` |
| **锚点条** | ✅ | 均为原生 `<a href="#steps|#key-points|#mistakes|#progression">`，键盘可达 |
| **键盘陷阱** | ✅ 无 | 连续 Tab 无「焦点卡死」检测（同一元素连续 3 次不变化即告警 → 未触发） |

- **判定：完全达标。**

---

## E. 其余 §9.7 约束抽查

### E.1 `prefers-reduced-motion` ✅
模拟 `reduce` 后：`matchMedia('(prefers-reduced-motion: reduce)').matches = true`，`html` 计算 `scroll-behavior: auto`（默认 `smooth`），主题按钮 `transition-duration` 由 `0.15s` 降为 `1e-05s`，全页**无 `animation/transition` 时长 > 0.05s 的元素**。**判定：达标。**

### E.2 禁止用颜色单独承载信息 ✅

| 通道 | 实现 | 判定 |
|---|---|---|
| 难度徽章 | **文字标签**（"入门/中级/…"）+ 同色圆点（颜色为辅） | ✅ 双通道 |
| 要领 / 常见错误 | `InfoList` 用**形状不同**的图标：`CheckCircle`（勾）vs `TriangleAlert`（三角） | ✅ 形状通道 |
| 常见错误条目 | "错误表现："`danger` 文字标签 + "纠正方法："`success` 文字标签 | ✅ 文字通道 |
| 风险/安全提示 | `TriangleAlert`/`Shield` 图标（形状）+ **加粗标题**（"高风险动作"/"安全提示"）+ 文案 | ✅ 形状+文字 |

### E.3 语义化 HTML 与 ARIA ✅

- **每页唯一 `h1`**：6 页实测 `h1Count = 1`；**每页唯一 `main`**：`mainCount = 1`（布局注释亦说明由页面持有 `main`，避免重复地标）。
- `<html lang="zh-CN">` ✅（全站）。
- 地标齐全：`header / nav / main / footer` 均在位。
- **`role="img"` 图位**：6 页共 23 个图位，**空 `aria-label` = 0**；内部装饰图标 `aria-hidden="true"`。
- **`aria-label` 描述动作而非文件名/序号** ✅（见 §E.4）。
- ⚠️ **axe-core `region`（moderate）**：免责提示条 `<aside role="note">` 位于**所有地标之外**（`AppLayout` 中它在 `Header` 之前、非任何 landmark 内），axe 报「内容未被地标包含」。**属 best-practice 级（不影响 Lighthouse 分数、非 WCAG A/AA 违规）**，建议包一层 landmark，交 team-lead 决定。

### E.4 60 个式页抽查（≥12）—— `aria-label` 非空且描述动作 ✅

抽查 **16** 式（覆盖 6 艺、含第 1/5/8/10 式边界）：**16/16 均满足**「恰好 1 个 `role="img"` + 非空 + 描述动作（非文件名/序号）」，长度 13–60 字。样例：

| 路由 | `aria-label`（节选） |
|---|---|
| `/arts/pushups/1` | 墙壁俯卧撑：面对墙壁站立撑墙、以脚尖为支点做推撑的最基础动作 |
| `/arts/pushups/10` | 单臂俯卧撑：俯卧撑体系的终极动作，单臂撑地、另一手背于身后…… |
| `/arts/squats/10` | 单腿深蹲：深蹲体系的终极动作，单腿站立、另一腿向前抬起至约与髋等高…… |
| `/arts/bridges/10` | 铁板桥：桥体系的终极形态——完整的往返动作…… |
| `/arts/handstand-pushups/1` | 靠墙顶立：倒立撑体系的起点，本质是「头顶撑在墙根地面、双手辅助、双脚靠墙」…… |

---

## F. 不达标 / 偏差项完整清单

| 级别 | 项 | 选择器 / 位置 | 实测值 | 期望值 | 来源组件 |
|---|---|---|---|---|---|
| **SERIOUS** | 难度徽章文字对比度（浅色） | `span.border-lv-X/40.bg-lv-X/10.text-lv-X`（入门/中级/进阶） | **4.13 / 4.39 / 4.23 : 1** | ≥ 4.5 : 1 | `src/components/ui/DifficultyBadge.tsx` |
| **MODERATE** | 站名 Logo 触控目标 | `header a[aria-label="囚徒健身 · 六艺十式动作指导站"]` | **62.4×24** | ≥ 44×44 | `src/components/layout/Header.tsx:76` |
| **MODERATE** | 页脚「首页」「关于」触控目标 | `footer nav[aria-label="页脚导航"] a` | **28×44** | ≥ 44×44 | `src/components/layout/Footer.tsx:65` |
| **MODERATE** | 式页锚点条「步骤/要领/错误」触控目标 | `main nav[aria-label="页内快速跳转"] a` | **28×44** | ≥ 44×44 | `src/pages/MoveDetail.tsx:362` |
| **MODERATE** | 安全提示「查看训练原则」触控目标 | `aside[role="note"] a` | **84×20** | ≥ 44×44 | `src/components/ui/SafetyNotice.tsx:56` |
| **MINOR** | 步骤/要领正文行高 | `ol>li>span.leading-relaxed` / `ul>li>span.leading-relaxed` | **1.625** | ≥ 1.70 | `StepList.tsx:31`、`InfoList.tsx:58` |
| **MINOR / 裁量** | 语义色描边对比度 | `border-danger/40`、`border-lv-X/40`、`border-accent/50` | **1.75–2.15:1**（浅）/ **2.03–2.72:1**（深） | ≥ 3 : 1（PRD 字面） | `DifficultyBadge` / `DisclaimerBar` / `RiskNote` |
| **BEST-PRACTICE** | 免责条在 landmark 之外 | `aside[role="note"]`（`AppLayout` 顶层） | axe `region` moderate | 内容应含于地标 | `AppLayout.tsx:45` |

---

## G. 无法测 / 未覆盖项及原因

| 项 | 原因 |
|---|---|
| **真实读屏（NVDA/VoiceOver）朗读验证** | 本机无读屏软件与语音合成环境；已用 axe-core + ARIA 语义 + `role=img`/`aria-label` 静态核验作为替代，**未做真人读屏端到端验证**。 |
| **性能类审计（Performance ≥ 90）** | 本次仅跑 `--only-categories=accessibility`（任务聚焦 P0-16 的可访问性；Performance 需另跑全类别）。 |
| **60 式全部详情页逐页跑分** | 按任务要求抽样 16 式（≥12）；其余 44 式由同一 `MoveArticle` 数据驱动渲染，结构一致，未逐页跑分。 |
| **补图阶段项**（`<img alt>`、懒加载、CLS 有图态） | 首版无线下图片素材，`FigureSlot` 占位态已就绪；补图后条款生效，本轮不适用。 |
| **打印样式 / OG 卡** | 属 P1，不在 P0-16 范围。 |

---

## H. 智能路由判定

**路由：`Engineer`（源码有 Bug）**

**理由**：Lighthouse 与 axe-core 两套独立工具一致复现同一源码级缺陷——`DifficultyBadge` 以 `bg-lv-X/10` 同色浅底承载等级色文字，导致浅色主题下「入门/中级/进阶」徽章对比度 **4.13–4.39:1 < 4.5:1**（WCAG AA 失败、axe `serious`、Lighthouse `color-contrast`）。另有 4 处独立触控目标 < 44×44 与 2 处列表正文行高 1.625 < 1.7 属同源实现偏差。**测试断言均与 PRD/架构要求一致，故错在源码，非测试。**

**一句话结论**：**P0-16 未完全达标——Lighthouse Accessibility 六页 96–100（过 ≥95 线）、深色主题对比度、键盘可达、reduced-motion、语义化、图位 `aria-label` 全部达标；唯「浅色主题难度徽章文字对比度 < 4.5:1」为必须修复的 serious 源码缺陷，另有 4 处触控目标偏小、2 处行高 1.625 待修，修复后即可判定完全达标。**
