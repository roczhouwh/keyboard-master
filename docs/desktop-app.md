# 键盘小达人 · 桌面化方案（决策参考文档）

> 状态：**待定**。本文档汇总 Electron 与 Tauri 两套方案的完整对比与实施要点，供日后真正动手时快速恢复上下文、进一步讨论决策。当前仅讨论，未实施。

---

## 背景与目标

把纯前端打字游戏（`F:\claudeapp\demo\type`）做成可在电脑上独立运行的桌面应用。

- 用户环境：Windows 11，Node v24 + npm 12 已装，**Rust/MSVC 未装**，WebView2 自带。
- 使用动机：**研究/练手**，且明确「欢迎学习新事物」→ 倾向 Tauri（可顺带学 Rust）。

## 核心难点（两方案共同）

游戏用 `fetch('words/gradeN.json')` 加载本地词库（`script.js:148`）。`file://` 协议下 fetch 会被浏览器 CORS 拦截（和双击打开 index.html 一样），**必须用自定义协议**让相对路径的 fetch 照常工作，从而**零改动游戏代码**。

- Electron：自定义 `app://` 协议（`protocol.registerSchemesAsPrivileged` + `protocol.handle`）
- Tauri：内置 `tauri://`/`app://` 资产协议，静态网页 + 打包资源天然支持 fetch

## 一、Electron 方案

### 核心信息

| 项 | 值 |
|---|---|
| 原理 | 打包 Chromium + Node |
| 后端语言 | JavaScript（已会） |
| 额外工具链 | **无**（Node 已装） |
| 安装包体积 | ~150MB |
| 内存占用 | 每窗口 ~100-200MB |
| 生态/文档 | 最成熟（VS Code/Slack/Discord 同款） |
| 跨平台一致性 | 完美（同一 Chromium） |

### 实施要点（`desktop/` 子目录外壳）

1. 目录：`desktop/package.json`（`main: main.js`，devDep: electron）+ `desktop/main.js`；`WEB_ROOT = path.join(__dirname, '..')`。
2. 启动前 `protocol.registerSchemesAsPrivileged([{ scheme:'app', privileges:{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true } }])` —— 必须有 `standard`+`supportFetchAPI`，fetch 才能在此协议工作。
3. `app.whenReady()` 内 `protocol.handle('app', handler)` 再 `createWindow()`；handler 用 `new URL(request.url)` 取 pathname → `path.join(WEB_ROOT, rel)`，**做路径遍历守卫**（resolve 后须仍在 WEB_ROOT 内），用 `net.fetch(pathToFileURL(file).toString())` 返回；找不到返 404。
4. `BrowserWindow({ width:1280, height:800, autoHideMenuBar:true, webPreferences:{ contextIsolation:true, nodeIntegration:false } })`，`loadURL('app://index.html')`。
5. 打包分发需另加 `electron-builder`。

### 评价

- ✅ 上手最快、零新语言、文档最多、今天就能看到窗口
- ❌ 体积大；Node 后端对此纯前端项目是浪费（Electron 最大卖点用不上）

## 二、Tauri 方案

### 核心信息

| 项 | 值 |
|---|---|
| 原理 | 系统 WebView（Win=WebView2） + Rust 后端 |
| 后端语言 | **Rust（需现学）** |
| 额外工具链 | Rust（~1GB）+ **MSVC 构建工具（~几个 GB）** + WebView2（Win11 自带 ✅） |
| 安装包体积 | ~5-10MB |
| 内存占用 | 低 |
| 生态/文档 | 较新但活跃，文档质量好 |

### 关键真相（务必清楚）

**纯静态打字游戏套 Tauri 几乎不写 Rust 代码** —— 脚手架自动生成几十行 `main.rs`，全靠 `tauri.conf.json` 配置。若动机是「学 Rust」，必须**主动加需 Rust 后端的真实功能**，否则装了一堆工具链却学不到东西。

### 推荐上手路径（学 Rust 向）

1. 装 rustup + MSVC Build Tools（勾选「使用 C++ 的桌面开发」）。
2. `npm create tauri-app@latest` 脚手架 → `npm run tauri dev`。
3. **为学 Rust 而加的真实后端功能**（小而真实，从易到难）：
   - **排行榜/学习进度写到本地文件**：用 Rust `dirs` + `std::fs`，前端 `invoke()` 调用（最推荐起步，直接碰所有权/错误处理）
   - **原生文件对话框导入/导出排行榜**：Rust `rfd` crate
   - **系统托盘 / 开机自启**
   - **自写音频后端**：`cpal` crate（较硬，偏进阶）

### 评价

- ✅ 体积小、架构匹配纯前端、能和 Rust 生态、学习价值高
- ❌ 安装门槛高、Rust 曲线陡、离「快速跑通」较远

## 三、决策框架（日后动手时用）

看你的**首要动机**：

- **想最快看到成果** → Electron（零新概念，今天能跑）
- **想顺带认真学 Rust / 接受安装成本** → Tauri，但**必须把它设计成「必然要写 Rust 后端」的项目**，否则学不到真东西
- **两者都要**（推荐）：外壳相互独立、互不冲突 —— 先用 Electron 把游戏迅速跑进桌面窗口，之后哪天想学 Rust 再拿 Tauri 重做外壳当练手。学习价值最大化，且今天就有可见成果。

## 四、后续步骤（需要时）

1. 确定选型（Electron / Tauri / 都做）。
2. 若 Tauri：确认 Rust + MSVC 是否已装，设计具体要加的 Rust 功能。
3. 按对应方案写详细实现计划（参考上方实施要点），讨论后再动手。

## 附：就地兼容确认（两方案通用）

- `styles.css`、`sounds/*`、`words/*`、内联 SVG 均相对路径 → 自定义协议下自动解析 ✅
- Google Fonts 走绝对 HTTPS → 联网正常，离线回退系统字体，游戏仍可用（可选：下载到本地免离线）
- localStorage / Web Audio / `<audio>` 在 Electron 与 Tauri 均原生支持 ✅