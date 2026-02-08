# nuxt-gin-tools

`nuxt-gin-tools` 是 `nuxt-gin-starter` 的配套开发工具包，提供 Nuxt + Gin 项目的统一命令入口。

核心目标：
- 一条命令启动前后端开发环境
- 自动处理 Go 侧依赖和文件监听重启
- 提供 OpenAPI 代码生成与构建打包辅助

## 功能概览

- `nuxt-gin dev`
  - 启动 Nuxt 开发服务
  - 启动 Go 文件监听（基于 `chokidar`）
  - Go 文件变化后自动重启 `go run main.go`
- `nuxt-gin install`
  - 执行 Nuxt prepare
  - 如果检测到 Go，则执行 `go mod download && go mod tidy`
- `nuxt-gin gen`
  - 基于 `openapi.yaml` 生成 Go / TS API 代码
- `nuxt-gin build`
  - 执行项目构建与打包流程
- `nuxt-gin cleanup`
  - 清理开发产物
- `nuxt-gin update`
  - 执行依赖更新流程

## 安装

在 `nuxt-gin-starter` 项目中作为依赖安装：

```bash
pnpm add nuxt-gin-tools
```

## 快速开始

```bash
# 初始化依赖（可选）
nuxt-gin install

# 启动开发
nuxt-gin dev
```

## 命令说明

### `nuxt-gin dev`

开发模式下会并行运行：
- Nuxt：`npx nuxt dev --port=<nuxtPort> --host`
- Go：监听变更并运行 `go run main.go`

Go 监听规则来自 `.go-watch.json`（见下文）。

### `nuxt-gin install`

- 总是执行：`npx nuxt prepare`
- 检测到 Go 时额外执行：`go mod download && go mod tidy`

### `nuxt-gin gen`

依赖 `openapi-generator-cli`，默认会：
- 生成 Go Gin server 相关代码
- 生成 TypeScript axios 客户端代码

### `nuxt-gin build`

执行工具链内置的构建与打包逻辑。

### `nuxt-gin cleanup`

清理由工具链生成的临时目录和产物。

### `nuxt-gin update`

执行项目约定的更新逻辑。

## 配置

### 1) `server.config.json`

`dev` 命令会读取该文件，常用字段：

- `ginPort`: Gin 服务端口
- `nuxtPort`: Nuxt 开发端口
- `baseUrl`: Nuxt baseUrl
- `killPortBeforeDevelop`: 开发前是否释放端口（默认 `true`）
- `cleanupBeforeDevelop`: 开发前是否执行 cleanup（默认 `false`）

### 2) `.go-watch.json`

Go 监听配置文件，示例：

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

也支持环境变量指定路径：

```bash
NUXT_GIN_WATCH_CONFIG=/path/to/.go-watch.json
```

## 环境依赖

- Node.js
- pnpm
- Go（需要运行 Gin 侧开发与依赖下载时）
- `openapi-generator-cli`（仅 `nuxt-gin gen` 需要）

## 说明

- Go 侧热更新已不再依赖 Air。
- 当前方案为：`chokidar` 监听文件变化 + 重启 `go run main.go`。

