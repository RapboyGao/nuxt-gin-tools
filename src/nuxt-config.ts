export interface ServerConfigJson {
  /**
   * 前端基础 URL
   * 用于指定前端路由的基础路径
   */
  baseUrl: string;
  /**
   * Nuxt 端口号
   * 用于指定 Nuxt 项目的开发服务器端口号
   * 例如，如果 Nuxt 项目的开发服务器端口号为 3000，则 nuxtPort 为 3000
   */
  nuxtPort: number;
  /**
   * Gin 端口号
   * 用于指定 Gin 服务器的端口号
   * 例如，如果 Gin 服务器的端口号为 8080，则 ginPort 为 8080
   */
  ginPort: number;
}

export interface MyNuxtConfig {
  /**
   * 服务器基础路径
   * 用于指定服务器端路由的基础路径
   * 例如，如果服务器端路由为 /api，则 serverBasePath 为 /api
   */
  apiBasePath: string;
  /**
   * WebSocket 代理基础路径列表（可选）
   * 例如：["/ws-go", "/socket"]
   * 会同时注入 Nitro devProxy 与 Vite proxy，默认启用 ws。
   */
  wsProxyBasePaths?: string[];
  /**
   * 服务器配置
   * 包含服务器端的相关配置，如端口号、基础路径等
   */
  serverConfig: ServerConfigJson;
}
/**
 * 创建默认的 Nuxt 配置
 * @param param0 包含服务器配置和 API 基础路径的参数对象
 * @returns Nuxt 配置对象
 * 
 * 用法如下：
 * ```typescript
 * import { createDefaultConfig } from 'nuxt-gin-tools/src/nuxt-config';
 * import type { NuxtConfig } from 'nuxt/config';
 * import { defineNuxtConfig } from 'nuxt/config';
 * import SERVER_CONFIG from './server.config.json';
 * import { BASE_PATH } from './vue/composables/api/base';
 * 
 * const config = createDefaultConfig({
 *   apiBasePath: BASE_PATH,
 *   serverConfig: SERVER_CONFIG,
 * }) as NuxtConfig;
 * 
 * export default defineNuxtConfig({
 *   ...config,
 * });
 * ```
 */
export function createDefaultConfig({
  serverConfig,
  apiBasePath,
  wsProxyBasePaths = [],
}: MyNuxtConfig) {
  /**
   * 处理基础路径，去除协议和域名部分，只保留路径部分
   * 例如，将 "https://example.com/api-go" 转换为 "/api-go"
   */
  const thisBasePath = apiBasePath.replace(/^https?:[/]{2}[^/]+/, "");
  const normalizedProxyBasePath = thisBasePath.endsWith("/")
    ? thisBasePath.slice(0, -1)
    : thisBasePath;
  const normalizeBasePath = (rawPath: string): string => {
    const trimmed = rawPath.replace(/^https?:[/]{2}[^/]+/, "");
    if (!trimmed) return "/";
    if (trimmed === "/") return "/";
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  };
  // Proxy target should point to backend origin only.
  // The matched route prefix (e.g. /api-go/v1, /ws-go) is preserved by proxy itself.
  // If target also appends basePath, final upstream path becomes duplicated and can
  // break websocket upgrades with ECONNRESET.
  const buildTarget = (): string => `http://127.0.0.1:${serverConfig.ginPort}`;

  /**
   * 目标服务器的 URL
   * 格式为：http://localhost:ginPort/serverBasePath
   * 其中，ginPort 是从 serverConfig 中获取的 Gin 服务器的端口号
   * serverBasePath 是从 MyNuxtConfig 中获取的服务器基础路径
   */
  const target = buildTarget();

  const proxyEntries: Record<
    string,
    { target: string; changeOrigin: boolean; ws: boolean }
  > = {
    [normalizedProxyBasePath]: {
      target,
      changeOrigin: true,
      ws: true,
    },
  };

  for (const rawPath of wsProxyBasePaths) {
    const normalizedPath = normalizeBasePath(rawPath);
    proxyEntries[normalizedPath] = {
      target: buildTarget(),
      changeOrigin: true,
      ws: true,
    };
  }

  return {
    buildDir: "vue/.nuxt", // 设置构建目录为 "vue/.nuxt"，表示 Nuxt 项目的构建输出将存放在该目录下
    srcDir: "vue", // 设置源代码目录为 "vue"，表示 Nuxt 项目的源代码将存放在该目录下
    // 设置服务器端代码的目录为 "vue/server"，表示服务器端的代码将存放在该目录下
    // serverDir: "vue/server",
    // 禁用服务器端渲染（SSR），即页面将在客户端进行渲染
    ssr: false,
    /**
     * 配置实验性功能
     * 禁用 payloadExtraction 功能，该功能可能用于提取页面的有效负载数据
     * 这里禁用它可能是为了避免某些兼容性问题或特定的项目需求
     */
    experimental: {
      payloadExtraction: false,
    },
    devtools: {
      timeline: {
        enabled: true,
      },
    },
    /**
     * 配置应用的基础 URL
     * 从 server.config.json 文件中获取 baseUrl 作为应用的基础 URL
     * 这个基础 URL 将用于构建应用的路由和请求地址
     */
    app: { baseURL: serverConfig.baseUrl },
    /**
     * 配置开发服务器的端口号
     * 从 server.config.json 文件中获取 nuxtPort 作为开发服务器的端口号
     * 启动开发服务器时，将使用该端口号进行监听
     */
    devServer: {
      port: serverConfig.nuxtPort,
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["X-Requested-With", "Content-Type"],
        credentials: true,
        maxAge: "1728000",
      },
    },
    nitro: {
      output: {
        // 设置输出目录为 "vue/.nuxt", 表示 Nitro 的构建输出
        dir: "vue/.output",
      },
      // 定义代理规则，将匹配基础路径的请求代理到目标服务器
      devProxy: proxyEntries,
    },

    vite: {
      server: {
        proxy: proxyEntries,
      },
      // 配置 Vite 插件
      plugins: [],
      // 配置 esbuild 编译器的选项
      // 设置 jsxFactory 为 "h"，这是 Vue 3 中用于创建虚拟 DOM 的函数
      // 设置 jsxFragment 为 "Fragment"，用于处理 JSX 中的片段
      esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
    },
  };
}
