# nuxt-gin-tools 🧰

[![npm version](https://img.shields.io/npm/v/nuxt-gin-tools?style=flat-square)](https://www.npmjs.com/package/nuxt-gin-tools)
[![npm downloads](https://img.shields.io/npm/dm/nuxt-gin-tools?style=flat-square)](https://www.npmjs.com/package/nuxt-gin-tools)
[![Node](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js&logoColor=white&style=flat-square)](https://nodejs.org)
[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt&logoColor=white&style=flat-square)](https://nuxt.com)
[![Go](https://img.shields.io/badge/Go-supported-00ADD8?logo=go&logoColor=white&style=flat-square)](https://go.dev)
[![License](https://img.shields.io/badge/license-MIT-0b5fff?style=flat-square)](./LICENSE)

`nuxt-gin-tools` is the companion CLI for [`nuxt-gin-starter`](https://github.com/RapboyGao/nuxt-gin-starter.git), built to make **Nuxt + Gin** development feel like one coherent workflow instead of two separate toolchains.

Quick Jump:

- [English](#english)
- [中文](#中文)

## English

### ✨ Highlights

- 🚀 One command to run Nuxt dev + Go watcher together
- 🔁 Automatic Go restart on file changes with `chokidar`
- 📦 Build-and-pack workflow for deployment artifacts
- 🧩 `pack.config.ts` support with typed config helper
- 🛡️ Config validation with `warn` and `error` feedback
- 🔧 Useful CLI switches for partial workflows like `--skip-go`
- 🎨 Colorful command banners and clearer terminal feedback

### 📦 Install

```bash
pnpm add -D nuxt-gin-tools
```

or

```bash
bun add -d nuxt-gin-tools
```

### ⚡ Quick Start

```bash
# optional bootstrap
nuxt-gin install

# start Nuxt + Go together
nuxt-gin dev
```

Common variants:

```bash
# frontend only
nuxt-gin dev --skip-go

# go watcher only
nuxt-gin dev --skip-nuxt

# skip cleanup / bootstrap checks
nuxt-gin dev --no-cleanup
```

### 🗂️ Commands

#### `nuxt-gin dev`

Runs the local development stack:

- Nuxt: `npx nuxt dev --port=<nuxtPort> --host`
- Go: watches files and restarts `go run main.go`
- prints a styled command banner before startup

Flags:

- `--skip-go`: start Nuxt only
- `--skip-nuxt`: start Go only
- `--no-cleanup`: skip pre-cleanup and bootstrap checks

#### `nuxt-gin install`

Bootstraps the project:

- always runs `npx nuxt prepare`
- if Go is available, also runs `go mod download && go mod tidy`
- prints a styled command banner before execution

#### `nuxt-gin build`

Runs the build-and-pack flow.

Terminal output includes:

- a styled command banner at startup
- the final `.7z` archive path after packing
- the bundle directory path used to assemble the release

Flags:

- `--skip-go`: skip Go build
- `--skip-nuxt`: skip Nuxt static build
- `--binary-name <name>`: override the Go binary name under `.build/.server`

#### `nuxt-gin cleanup`

Removes generated temp files and build output.

Also prints a styled command banner before cleanup starts.

#### `nuxt-gin update`

Updates project dependencies with a conservative default strategy:

- Node: auto-detects `bun update`, `pnpm update`, or `npm update`
- Go: `go get -u=patch ./... && go mod tidy`

Flags:

- `--latest`: switch to a more aggressive upgrade strategy
- `--skip-go`: skip Go dependency updates
- `--skip-node`: skip Node dependency updates

Also prints a styled command banner before execution.

### 🧩 `pack.config.ts` / `pack.config.json`

`nuxt-gin build` can auto-load pack config from the project root with this priority:

1. `pack.config.ts`
2. `pack.config.js`
3. `pack.config.cjs`
4. `pack.config.mjs`
5. `pack.config.json`

If multiple config files exist, the CLI prints a `warn` and uses the first one by priority.

Recommended TypeScript form:

```ts
import createPackConfig from 'nuxt-gin-tools/src/pack';

export default createPackConfig({
  zipName: 'server.7z',
  extraFilesGlobs: ['prisma/**'],
  packageJson: {
    private: true,
  },
});
```

Legacy JSON is still supported:

```json
{
  "zipName": "server.7z",
  "extraFilesGlobs": ["prisma/**"]
}
```

Validation behavior:

- ❌ obvious type problems produce an `error` and stop packing
- ⚠️ ambiguous but survivable cases produce a `warn`
- 📝 example: if both `zipPath` and `zipName` are present, `zipPath` wins and a warning is shown

### 🧱 `pack.config.ts` Helper

Use the helper from [`src/pack.ts`](./src/pack.ts):

```ts
import createPackConfig from 'nuxt-gin-tools/src/pack';

export default createPackConfig({
  serverPath: '.build/production/server',
  zipName: 'release.7z',
});
```

It provides:

- `PackConfig` type
- `createPackConfig(config)` helper
- default export as `createPackConfig`

### ⚙️ Runtime Config

#### `server.config.json`

`dev` reads this file for the main runtime wiring:

- `ginPort`: Gin server port
- `nuxtPort`: Nuxt dev port
- `baseUrl`: Nuxt base URL
- `killPortBeforeDevelop`: whether to free ports before dev, default `true`
- `cleanupBeforeDevelop`: whether to cleanup before dev, default `false`

#### Frontend Runtime Exposure

`createDefaultConfig` injects values into Nuxt `runtimeConfig.public`:

- `public.ginPort`: available in development, `null` in production
- `public.isDevelopment`: direct development flag

Example:

```ts
const config = useRuntimeConfig();
const ginPort = config.public.ginPort;
const isDevelopment = config.public.isDevelopment;
```

#### `.go-watch.json`

Go watcher rules come from `.go-watch.json`:

```json
{
  "tmpDir": ".build/.server",
  "testDataDir": "testdata",
  "includeExt": ["go", "tpl", "html"],
  "includeDir": [],
  "includeFile": [],
  "excludeDir": [
    "assets",
    ".build/.server",
    "vendor",
    "testdata",
    "node_modules",
    "vue",
    "api",
    ".vscode",
    ".git"
  ],
  "excludeFile": [],
  "excludeRegex": ["_test.go"]
}
```

You can also point to a custom watcher config:

```bash
NUXT_GIN_WATCH_CONFIG=/path/to/.go-watch.json
```

### 🖥️ Environment

- Node.js
- pnpm or bun
- Go, if you need the Gin side to run
- no extra generator dependency is required for the current command set

### 📝 Notes

- 💨 Go hot reload no longer depends on Air
- 👀 The current watcher model is `chokidar` + restart `go run main.go`
- 🪟 Packaging uses platform-aware executable naming: Windows defaults to `.exe`, Linux/macOS defaults to no extension
- 🌈 Main commands print a consistent banner and clearer success/info output in the terminal
- 📦 Both `pnpm` and `bun` are supported, but one working tree should stick to one package manager at a time

---

## 中文

### ✨ 功能亮点

- 🚀 一条命令同时启动 Nuxt 与 Go 开发环境
- 🔁 基于 `chokidar` 的 Go 文件监听与自动重启
- 📦 内置构建与打包流程，适合产物发布
- 🧩 支持 `pack.config.ts`，并提供类型化 helper
- 🛡️ 对打包配置做校验，区分 `warn` 和 `error`
- 🔧 支持 `--skip-go` 等局部开发参数
- 🎨 提供更醒目的彩色命令行 banner 与输出提示

### 📦 安装

```bash
pnpm add -D nuxt-gin-tools
```

或

```bash
bun add -d nuxt-gin-tools
```

### ⚡ 快速开始

```bash
# 可选：初始化依赖
nuxt-gin install

# 同时启动前后端开发环境
nuxt-gin dev
```

常见变体：

```bash
# 仅启动前端
nuxt-gin dev --skip-go

# 仅启动 Go 监听
nuxt-gin dev --skip-nuxt

# 跳过预清理 / 预安装检查
nuxt-gin dev --no-cleanup
```

### 🗂️ 命令说明

#### `nuxt-gin dev`

启动本地开发环境：

- Nuxt：`npx nuxt dev --port=<nuxtPort> --host`
- Go：监听文件变化并重启 `go run main.go`
- 启动前会输出一段样式化 banner

参数：

- `--skip-go`：只启动 Nuxt
- `--skip-nuxt`：只启动 Go
- `--no-cleanup`：跳过 develop 前的 cleanup / bootstrap 检查

#### `nuxt-gin install`

用于初始化项目：

- 总是执行 `npx nuxt prepare`
- 检测到 Go 后，额外执行 `go mod download && go mod tidy`
- 执行前会输出一段样式化 banner

#### `nuxt-gin build`

执行构建与打包流程。

命令行输出会额外包含：

- 启动时的样式化 banner
- 打包完成后的 `.7z` 文件绝对路径
- 组装发布产物时使用的 bundle 目录路径

参数：

- `--skip-go`：跳过 Go 构建
- `--skip-nuxt`：跳过 Nuxt 静态构建
- `--binary-name <name>`：覆盖 `.build/.server` 下的 Go 二进制名称

#### `nuxt-gin cleanup`

清理临时文件与构建产物。

执行前也会输出一段样式化 banner。

#### `nuxt-gin update`

按偏保守的默认策略更新依赖：

- Node：自动识别 `bun update`、`pnpm update` 或 `npm update`
- Go：`go get -u=patch ./... && go mod tidy`

参数：

- `--latest`：切换成更激进的升级策略
- `--skip-go`：跳过 Go 依赖更新
- `--skip-node`：跳过 Node 依赖更新

执行前也会输出一段样式化 banner。

### 🧩 `pack.config.ts` / `pack.config.json`

`nuxt-gin build` 会自动读取项目根目录中的打包配置，优先级如下：

1. `pack.config.ts`
2. `pack.config.js`
3. `pack.config.cjs`
4. `pack.config.mjs`
5. `pack.config.json`

如果同时存在多个配置文件，CLI 会输出 `warn`，并按优先级选择第一个。

推荐使用 TypeScript 写法：

```ts
import createPackConfig from 'nuxt-gin-tools/src/pack';

export default createPackConfig({
  zipName: 'server.7z',
  extraFilesGlobs: ['prisma/**'],
  packageJson: {
    private: true,
  },
});
```

旧的 JSON 配置仍然兼容：

```json
{
  "zipName": "server.7z",
  "extraFilesGlobs": ["prisma/**"]
}
```

校验规则：

- ❌ 明显类型错误会直接 `error` 并终止打包
- ⚠️ 可继续执行但存在歧义的情况会输出 `warn`
- 📝 例如同时设置 `zipPath` 和 `zipName` 时，会提示 `zipPath` 优先生效

### 🧱 `pack.config.ts` Helper

可通过 [`src/pack.ts`](./src/pack.ts) 使用 helper：

```ts
import createPackConfig from 'nuxt-gin-tools/src/pack';

export default createPackConfig({
  serverPath: '.build/production/server',
  zipName: 'release.7z',
});
```

它提供：

- `PackConfig` 类型
- `createPackConfig(config)` 函数
- 默认导出即 `createPackConfig`

### ⚙️ 运行时配置

#### `server.config.json`

`dev` 命令会读取这个文件来确定运行方式：

- `ginPort`：Gin 服务端口
- `nuxtPort`：Nuxt 开发端口
- `baseUrl`：Nuxt 的 base URL
- `killPortBeforeDevelop`：开发前是否释放端口，默认 `true`
- `cleanupBeforeDevelop`：开发前是否执行 cleanup，默认 `false`

#### 前端运行时暴露

`createDefaultConfig` 会把以下值注入 Nuxt `runtimeConfig.public`：

- `public.ginPort`：开发环境可读，生产环境为 `null`
- `public.isDevelopment`：当前是否为开发环境

示例：

```ts
const config = useRuntimeConfig();
const ginPort = config.public.ginPort;
const isDevelopment = config.public.isDevelopment;
```

#### `.go-watch.json`

Go 监听规则来自 `.go-watch.json`：

```json
{
  "tmpDir": ".build/.server",
  "testDataDir": "testdata",
  "includeExt": ["go", "tpl", "html"],
  "includeDir": [],
  "includeFile": [],
  "excludeDir": [
    "assets",
    ".build/.server",
    "vendor",
    "testdata",
    "node_modules",
    "vue",
    "api",
    ".vscode",
    ".git"
  ],
  "excludeFile": [],
  "excludeRegex": ["_test.go"]
}
```

也支持通过环境变量指定：

```bash
NUXT_GIN_WATCH_CONFIG=/path/to/.go-watch.json
```

### 🖥️ 环境依赖

- Node.js
- pnpm 或 bun
- Go，若需要运行 Gin 侧开发流程
- 当前命令集不再依赖额外的代码生成器

### 📝 说明

- 💨 Go 热更新不再依赖 Air
- 👀 当前 Go 开发监听方案为 `chokidar` + 重启 `go run main.go`
- 🪟 打包时会按平台生成可执行文件名：Windows 默认 `.exe`，Linux/macOS 默认无扩展名
- 🌈 主要命令会输出统一风格的 banner，并提供更清晰的成功 / 信息提示
- 📦 同一个工作副本建议固定使用一种包管理器，不要在同一套依赖目录里反复混用 `pnpm` 与 `bun`
