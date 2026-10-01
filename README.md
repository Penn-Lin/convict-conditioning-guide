# 囚徒健身 · 六艺十式动作指导站

把《囚徒健身》（Paul Wade / Convict Conditioning）的「六艺十式」体系整理成**结构化动作指导**
的纯静态单页应用：六门基础动作 × 每门十式 = 60 式，每式包含动作描述、分解步骤、要领要点、
常见错误、进阶标准与训练目标，并内置一套**纯规则驱动的动态训练计划引擎**。

- 线上地址：<https://convict-conditioning-guide.adasoigivea.workers.dev>
- 托管：Cloudflare Workers 静态资源
- 已支持 PWA：可安装为桌面 / 手机应用，离线可用

---

## 技术栈

| 层面 | 选型 | 说明 |
|---|---|---|
| 构建 | Vite 5.4 | 纯静态产物直出 `dist/` |
| 框架 | React 18 + TypeScript 5.5 | 无服务端、无后端接口 |
| 路由 | react-router-dom v6 | `BrowserRouter`，靠 Workers 的 SPA 回退接管深层路由 |
| 样式 | Tailwind CSS 3.4 | 语义 token 全部映射到 CSS 变量，浅 / 深主题共用一套类名 |
| 图标 | lucide-react | |
| 测试 | Vitest 2 | 只覆盖 `src/lib/plan/**` 的纯函数引擎与 `src/lib/designTokens.test.ts` |
| 部署 | Cloudflare Workers | `wrangler.jsonc` 声明为纯静态资源站点 |

**依赖极简是硬约束**：所有构建期脚本（`scripts/*.mjs`）零依赖，只用 Node 内置模块；
PWA 也没有引入 `vite-plugin-pwa`／Workbox，而是自行生成 Service Worker（见下文）。

---

## 目录结构

```
.
├── index.html              # 单页入口（含防主题闪烁的内联脚本 + PWA 接线）
├── package.json            # 脚本与依赖（改依赖必须同步 package-lock.json）
├── wrangler.jsonc          # Cloudflare Workers 配置（勿删，见文件内注释）
├── tailwind.config.ts      # 设计 token（颜色 / 字体 / 圆角 / 阴影）
├── vite.config.ts          # 构建配置 + Vitest 配置
│
├── public/                 # 原样拷贝进 dist/
│   ├── actions/            # 六艺动作图 6 × 10 式 × 2 张 = 120 张
│   ├── icons/              # PWA 图标全套（any / maskable / apple-touch / favicon）
│   ├── manifest.json       # PWA 清单
│   ├── favicon.svg
│   └── robots.txt
│
├── scripts/                # 构建期脚本（零依赖）
│   ├── check-lock.mjs      # 守卫：package.json 与 lock 文件是否一致
│   ├── check-figures.mjs   # 守卫：public/actions/ 目录与 artsMeta 的 slug 是否完全一致
│   ├── gen-sitemap.mjs     # 构建后生成 dist/sitemap.xml（数据派生，不硬编码）
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
├── books/                  # 原书 PDF / MOBI，仅本地核对用，已 gitignore
└── .book_extract/          # 原书解包与抽图工作区，已 gitignore
```

---

## 常用命令

```bash
npm install            # 安装依赖（受限环境见下方「已知坑」）
npm run dev            # 本地开发（http://localhost:5173）
npm run build          # 完整构建：守卫 → tsc → vite build → sitemap → sw
npm run preview        # 预览 dist/（http://localhost:4173）
npm test               # 跑单测（Vitest）

npm run check:lock     # 单独校验依赖与锁文件一致性
npm run check:figures  # 单独校验动作图资源完整性
npm run build:sitemap  # 只重新生成 sitemap
```

`npm run build` 的链路是：

```
check-lock → check-figures → tsc(--noEmit ×2) → vite build → gen-sitemap → gen-sw
```

前三步是**守卫**，任何一步失败都不产出产物。其中两个守卫都是为了拦住**静默失败**：
类型系统看不见、单测覆盖不到、失败时页面照常渲染只是「有点不对」的那类问题。

---

## PWA

装到桌面 / 手机主屏后是一个独立窗口应用，断网也能用。

| 文件 | 作用 |
|---|---|
| `public/manifest.json` | 应用清单：名称、图标、`display: standalone`、主题色 |
| `public/icons/*` | 图标全套：`any` 圆角版、`maskable` 安全区版、`apple-touch`、`favicon` |
| `dist/sw.js` | 构建期由 `scripts/gen-sw.mjs` 生成，**不进仓库** |

Service Worker 的缓存策略：

- **应用外壳**（`index.html` / JS / CSS / 图标 / manifest / sitemap）——安装时预缓存，
  缓存名带构建哈希，新版本自动清理旧缓存；
- **页面导航**——网络优先，离线回退到缓存的 `index.html`（SPA 回退）；
- **动作图 `/actions/*`**——缓存优先 + 按需填充。120 张共 6.2 MB，不做安装期预缓存，
  看过哪张就离线有哪张。

### 换图标要动什么

图标文件**必须换 URL 才能可靠刷新**（浏览器缓存、SW 预缓存、系统 launcher 各有一层）。

1. 改 `scripts/gen-icons.py` 里的设计参数，重跑：
   ```bash
   "C:/Users/Zupeng Lin/.workbuddy/binaries/python/envs/default/Scripts/python.exe" scripts/gen-icons.py
   ```
2. `public/manifest.json` 与 `index.html` 里图标的 `?v=` 全部 +1
3. 重新构建（`gen-sw.mjs` 会自动带上新的哈希，无需手改版本号）
4. 已安装过的应用要**卸载重装**才会换图标

---

## 部署

推送 `main` 后由 Cloudflare 侧触发构建（仓库内**没有** GitHub Actions）。

- `wrangler.jsonc` 显式声明这是纯静态资源站点，因此不会触发 Cloudflare 的
  「框架自动配置」（那个流程要求 Vite ≥ 6，本项目刻意停在 5.4）。
- 深层路由（如 `/arts/pushups/5`）刷新不 404，依赖 `wrangler.jsonc` 里的
  `not_found_handling: "single-page-app"`。**不要**再往 `public/` 放 `_redirects`，
  Workers 静态资源校验器会判它死循环并让构建失败。

---

## 已知坑（踩过的，别再踩）

1. **改依赖必须同步锁文件。** Cloudflare 跑的是 `npm clean-install`（严格按锁文件），
   与本地 `npm install` 行为不同。改完 `package.json` 要
   `npm install --package-lock-only` 并把锁文件一起提交（`check-lock.mjs` 会拦）。
2. **Cloudflare 的「Retry deployment」重放旧提交**，不是重新构建最新代码。
   构建失败后别点 Retry，推一个新提交触发全新构建。
3. **资源目录名必须逐字等于 `artsMeta.ts` 的 slug**（kebab-case，如 `leg-raises`）。
   拼错是静默 404，页面只会显示占位块。`check-figures.mjs` 是这条的守卫。
4. **Tailwind 透明度修饰符只能是 5 的倍数。** `bg-accent/8` 不报错也不生成类 →
   背景静默消失。`designTokens.test.ts` 是守卫。
5. **深色主题下不要用 `text-white` 配亮色底**，统一用 `text-bg`。
6. **递增 `STORAGE_VERSION` 必须同步追加 `storage.KNOWN_VERSIONS`**，
   否则所有老存档会被判为「版本不认识」而清空。
7. 本机 `npm install` 若报 EPERM / EBUSY，加 `--cache ./.npm-cache`；
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
