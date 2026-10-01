# 囚徒健身 · 六艺十式动作指导站

把《囚徒健身》（Paul Wade / Convict Conditioning）的「六艺十式」体系整理成**结构化动作指导**
的纯静态单页应用：六门基础动作 × 每门十式 = 60 式，每式包含动作描述、分解步骤、要领要点、
常见错误、进阶标准与训练目标，并内置一套**纯规则驱动的动态训练计划引擎**。

- 线上地址：<https://convict-conditioning-guide.pages.dev>
- 托管：Cloudflare Workers 静态资源
- 已支持 PWA：可安装为桌面 / 手机应用，离线可用

---

## 技术栈

| 层面 | 选型 | 说明 |
|---|---|---|
| 构建 | Vite 5.4 | 纯静态产物直出 `dist/` |
| 框架 | React 18 + TypeScript 5.5 | 无服务端、无后端接口 |
| 路由 | react-router-dom v6 | `BrowserRouter`，靠 Pages 的 SPA 自动兜底接管深层路由 |
| 样式 | Tailwind CSS 3.4 | 语义 token 全部映射到 CSS 变量，浅 / 深主题共用一套类名 |
| 图标 | lucide-react | |
| 测试 | Vitest 2 | 只覆盖 `src/lib/plan/**` 的纯函数引擎与 `src/lib/designTokens.test.ts` |
| 部署 | Cloudflare Pages | 纯静态托管，无需任何 wrangler 配置 |

**依赖极简是硬约束**：所有构建期脚本（`scripts/*.mjs`）零依赖，只用 Node 内置模块；
PWA 也没有引入 `vite-plugin-pwa`／Workbox，而是自行生成 Service Worker（见下文）。

---

## 目录结构

```
.
├── index.html              # 单页入口（含防主题闪烁的内联脚本 + PWA 接线）
├── package.json            # 脚本与依赖（改依赖必须同步 package-lock.json）
├── tailwind.config.ts      # 设计 token（颜色 / 字体 / 圆角 / 阴影）
├── vite.config.ts          # 构建配置 + Vitest 配置
│
├── public/                 # 原样拷贝进 dist/
│   ├── actions/            # 六艺动作图 6 × 10 式 × 2 张 = 120 张
│   ├── icons/              # PWA 图标全套（any / maskable / apple-touch / favicon）
│   ├── manifest.json       # PWA 清单
│   └── favicon.svg         # 标签页图标（矢量，与 PWA 图标同一套「囚」标记）
│
├── scripts/                # 构建期脚本（零依赖）
│   ├── check-lock.mjs      # 守卫：package.json 与 lock 文件是否一致
│   ├── check-figures.mjs   # 守卫：public/actions/ 目录与 artsMeta 的 slug 是否完全一致
│   ├── check-deploy.mjs    # 守卫：dist/ 里不能有 404.html / _redirects（会毁掉 SPA 兜底）
│   ├── gen-sitemap.mjs     # 构建后生成 dist/sitemap.xml + dist/robots.txt（数据派生）
│   ├── gen-sw.mjs          # 构建后生成 dist/sw.js（PWA Service Worker）
│   └── gen-icons.py        # 生成 PWA 图标全套（Pillow，改动图标时重跑）
│
├── src/
│   ├── main.tsx            # 挂载入口 + Service Worker 注册
│   ├── App.tsx             # 路由表
│   ├── index.css           # CSS 变量（浅 / 深主题）+ 原生 <dialog> 样式
│   ├── components/         # layout / plan / ui 三组组件
│   ├── data/               # 60 式内容数据（arts/*.ts）+ 六艺元数据
│   ├── hooks/              # 主题、本地存储、训练状态
│   ├── lib/
│   │   ├── plan/           # 动态训练计划引擎（纯函数，单测覆盖）
│   │   ├── tones.ts        # 模块色相体系（改颜色前必读）
│   │   └── ...
│   └── pages/              # 8 个页面
│
├── docs/                   # 设计与核对文档（见下方索引）
├── icon-design/            # PWA 图标的源图（由 gen-icons.py 绘制，改图标后一起提交）
├── books/                  # 原书 PDF / MOBI，仅本地核对用，已 gitignore
└── .book_extract/          # 原书解包与抽图工作区，已 gitignore
```

---

## 常用命令

```bash
npm install            # 安装依赖（受限环境见下方「已知坑」）
npm run dev            # 本地开发（http://localhost:5173）
npm run build          # 完整构建：守卫 → tsc → vite build → 守卫 → sitemap → sw
npm run preview        # 预览 dist/（http://localhost:4173）
npm test               # 跑单测（Vitest）

npm run check:lock     # 单独校验依赖与锁文件一致性
npm run check:figures  # 单独校验动作图资源完整性
npm run check:deploy   # 单独校验构建产物对 Pages 是否安全
npm run build:sitemap  # 只重新生成 sitemap + robots
npm run gen:icons      # 重新生成 PWA 图标全套（需 default venv 的 Pillow）
```

`npm run build` 的链路是：

```
check-lock → check-figures → tsc(--noEmit ×2) → vite build
          → check-deploy → gen-sitemap → gen-sw
```

其中三个 `check:*` 与 `gen-sw` 末尾的自检都是为了拦住**静默失败** ——
类型系统看不见、单测覆盖不到、失败时页面照常渲染只是「有点不对」的那类问题。

---

## PWA

装到桌面 / 手机主屏后是一个独立窗口应用，断网也能用。

| 文件 | 作用 |
|---|---|
| `public/manifest.json` | 应用清单：名称、图标、`display: standalone`、主题色 |
| `public/icons/*` | 图标全套：`any` 圆角版、`maskable` 安全区版、`apple-touch`、`favicon` |
| `public/favicon.svg` | 标签页图标（矢量，与 PNG 图标共用同一套「囚」标记的几何） |
| `dist/sw.js` | 构建期由 `scripts/gen-sw.mjs` 生成，**不进仓库** |

标记符号就是站名本身 —— **「囚」**（`囗` + `人`），底色用全站唯一的「行动」色相 accent 橙。

Service Worker 的缓存策略：

- **应用外壳**（`index.html` / JS / CSS / 图标 / manifest / sitemap）——安装时预缓存，
  缓存名带构建哈希，新版本自动清理旧缓存；
- **页面导航**——网络优先，离线回退到缓存的 `index.html`（SPA 回退）；
- **动作图 `/actions/*`**——缓存优先 + 按需填充。120 张共 6.2 MB，不做安装期预缓存，
  看过哪张就离线有哪张。

### 换图标要动什么

图标文件**必须换 URL 才能可靠刷新**（浏览器缓存、SW 预缓存、系统 launcher 各有一层）。

1. 改 `scripts/gen-icons.py` 里的设计参数，重跑 `npm run gen:icons`
2. `public/manifest.json` 与 `index.html` 里图标的 `?v=` 全部 +1
   （**`favicon.svg` 也要带** —— 它换了内容但路径不变，不带参数就一直在吃缓存）
3. 重新构建（`gen-sw.mjs` 会自动带上新的哈希，无需手改版本号）
4. 已安装过的应用要**卸载重装**才会换图标

`gen-icons.py` 里三条容易重犯的坑（都写在文件注释里）：

- **maskable 版必须是「整体重绘」**（底色满幅、只把标记缩到 78% 安全区），
  不是「把 any 版缩小了垫在底板上」—— 后者会出现「方中带方」的硬边；
- **标记必须画在独立图层上再 `alpha_composite` 到底图**。直接
  `ImageDraw.Draw(img, 'RGBA')` 往不透明底上画会连底图 alpha 一起拉低，
  图看着完全正常，只有「满幅不透明」断言会炸；
- **32px 走特化参数**（加粗 + 略放大），否则细笔画抗锯齿后糊成灰边。

---

## 部署

仓库内**没有** GitHub Actions，推送 `main` 后由 Cloudflare 侧触发构建。

### 站点地址是构建期变量

`sitemap.xml` 与 `robots.txt` 都由 `scripts/gen-sitemap.mjs` 在构建期生成，
基准地址取环境变量 `SITE_URL`，没有则回落到脚本里的 `DEFAULT_SITE_URL`
（当前是 `https://convict-conditioning-guide.pages.dev`）。

绑了自有域名就在 Cloudflare 项目设置的 **环境变量** 里加一条 `SITE_URL`，**不用改代码**。

> 这两个文件刻意不在 `public/` 里写死 —— 否则换域名时 sitemap 改了、robots 没改，
> 两个文件指向不同域名，属于只在抓取日志里才看得见的静默不一致。

### Cloudflare Pages（当前托管）

在 Dashboard →「Workers 和 Pages」→ 创建 → **Pages** → 连接 Git → 选本仓库：

| 设置项 | 值 |
|---|---|
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| 环境变量 | `SITE_URL` = 站点地址（绑自有域名后才需要，见上） |

**部署目标的关键机制**：Pages 靠「输出目录里有没有顶层 `404.html`」判断这是不是单页应用 ——
**没有 `404.html`** 就把 `index.html` 兜底给所有未匹配路径，这正是深层路由
（如 `/arts/pushups/5`）刷新不 404 的唯一依靠。

由此引出两条**必须守住的约束**，`npm run check:deploy` 会在构建期拦截：

1. ⚠️ **不要往 `public/` 放 `404.html`** —— 一放上去 Pages 就认为你要自定义 404 页，
   从此所有深链刷新真的返回 404。构建、tsc、单测、部署日志全都是绿的，只有点进去才发现。
2. ⚠️ **不需要 `_redirects`**，写 `/* /index.html 200` 反而会被判成重定向死循环。

仓库里**不放 `wrangler.jsonc`**：Pages 的 Git 构建如果看到一份没有 `pages_build_output_dir`
的 Worker 配置会拒绝部署，而 `-c` 指定别的配置文件同样不被接受 —— 只能把它移走。
本项目是纯静态站点，不需要任何 wrangler 配置。

### 关于国内访问（重要）

`*.pages.dev` 与 `*.workers.dev` **都在 DNS 污染名单上**，区别只是命中率：

| 域名 | 国内实测 |
|---|---|
| `*.workers.dev` | 自 2022-05 起被连续屏蔽 —— 基本必须走代理 |
| `*.pages.dev` | 同为污染目标，但部分运营商 / 时段能通，属「不稳定」而非「完全不可用」 |

两者都是**免费二级域名、没有 ICP 备案**，所以拿不到大陆节点，只能走海外节点 ——
这是「不稳定」的根本原因，换平台治不了本。

**真正的解法是绑自有域名**（Pages 也支持），绕开平台域名层。
要面向国内用户长期稳定访问，只有「自有域名 + 备案 + 国内 CDN」这一条路。

### 从 Workers 迁过来时注意

同名的一个 Worker 和一个 Pages 项目在 Cloudflare 上是**两个独立的部署目标**，
可以同时存在、都「部署成功」，但只有其中一个挂着你的自定义域名 ——
很容易出现「日志说成功、线上没变化」。判断某个域名归谁，别从配置文件推断：

```bash
npx wrangler pages project list    # 输出里会列出每个项目挂着的域名
```

---

## 已知坑（踩过的，别再踩）

1. **改依赖必须同步锁文件。** Cloudflare 跑的是 `npm clean-install`（严格按锁文件），
   与本地 `npm install` 行为不同。改完 `package.json` 要
   `npm install --package-lock-only` 并把锁文件一起提交（`check-lock.mjs` 会拦）。
2. **Cloudflare 的「Retry deployment」重放旧提交**，不是重新构建最新代码。
   构建失败后别点 Retry，推一个新提交触发全新构建。
3. **`dist/` 里不能有顶层 `404.html`。** Pages 见到它就关掉 SPA 兜底，
   所有深链刷新变 404，而构建与部署日志全绿。`check-deploy.mjs` 是这条的守卫。
4. **资源目录名必须逐字等于 `artsMeta.ts` 的 slug**（kebab-case，如 `leg-raises`）。
   拼错是静默 404，页面只会显示占位块。`check-figures.mjs` 是这条的守卫。
5. **Tailwind 透明度修饰符只能是 5 的倍数。** `bg-accent/8` 不报错也不生成类 →
   背景静默消失。`designTokens.test.ts` 是守卫。
6. **深色主题下不要用 `text-white` 配亮色底**，统一用 `text-bg`。
7. **递增 `STORAGE_VERSION` 必须同步追加 `storage.KNOWN_VERSIONS`**，
   否则所有老存档会被判为「版本不认识」而清空。
8. **换图标必须换 URL**（`?v=` 同时 +1，且 `favicon.svg` 也要带参数）——
   只替换文件内容时，浏览器缓存 / SW 预缓存 / 系统 launcher 任何一层都可能继续用旧图。
9. 本机 `npm install` 若报 EPERM / EBUSY，加 `--cache ./.npm-cache`；
   esbuild 的 postinstall 版本自检报错不影响使用。

---

## 文档索引（`docs/`）

| 文档 | 内容 |
|---|---|
| [PRD.md](docs/PRD.md) | 产品需求：目标、范围、页面清单、验收标准 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构、目录约定、任务分解 |
| [DYNAMIC-PLAN-DESIGN.md](docs/DYNAMIC-PLAN-DESIGN.md) | 动态训练计划引擎设计（规则驱动，含参数与取舍） |
| [SITE-GUIDE.md](docs/SITE-GUIDE.md) | 全站功能全览与使用指南（面向使用者） |
| [CONTENT-REVIEW-CHECKLIST.md](docs/CONTENT-REVIEW-CHECKLIST.md) | 60 式内容复核清单 |
| [content-reference.md](docs/content-reference.md) | 60 式结构化参考数据 |
| [book-reference.md](docs/book-reference.md) | 对官方中文版的数值核对 |
| [book-verify-mechanics.md](docs/book-verify-mechanics.md) | 动作机制核对报告 |
| [book-pdf-spotcheck.md](docs/book-pdf-spotcheck.md) | PDF 影印本 OCR 存疑数值复核 |
| [accessibility-audit.md](docs/accessibility-audit.md) | 可访问性与可读性量化验收报告 |
| [class-diagram.mermaid](docs/class-diagram.mermaid) / [sequence-diagram.mermaid](docs/sequence-diagram.mermaid) | 类图 / 时序图 |
| [design/](docs/design/) | 设计稿预览页与计划演示脚本 |

---

## 版权与免责

本站为非商业性的个人学习参考项目，内容基于 Paul Wade《囚徒健身》整理改写，
著作权归原作者与出版方所有（中文版：北京科学技术出版社）。

**本站为健身科普与动作指导，不是医疗建议。** 任何训练都有受伤风险，请量力而行；
因参照本站内容训练导致的伤害或损失，本站及内容维护者不承担责任。
