import { request, type IncomingMessage, type ServerResponse } from "node:http";

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
   * 后端代理基础路径列表（可选）
   * 例如：["/api", "/auth", "/ws-go"]
   * 未传时默认使用 ["/api", "/ws"]。
   */
  proxyBasePaths?: string[];
  /**
   * WebSocket 代理基础路径列表（可选）
   * 例如：["/ws-go", "/socket"]
   * 仅用于标记对应路径启用 ws（会并入 proxyBasePaths）。
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
  proxyBasePaths,
  wsProxyBasePaths,
}: MyNuxtConfig) {
  const normalizeBaseUrl = (value: string) => {
    const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
    if (withLeadingSlash !== "/" && withLeadingSlash.endsWith("/")) {
      return withLeadingSlash.slice(0, -1);
    }
    return withLeadingSlash;
  };
  const normalizedBaseUrl = normalizeBaseUrl(serverConfig.baseUrl);
  const isViteInternalRequest = (requestPath: string) => {
    return (
      requestPath.startsWith("/@vite") ||
      requestPath.startsWith("/__vite") ||
      requestPath.startsWith("/node_modules/") ||
      requestPath.startsWith("/@id/")
    );
  };
  const isBaseUrlRequest = (requestPath: string) => {
    if (normalizedBaseUrl === "/") {
      return true;
    }
    return requestPath === normalizedBaseUrl || requestPath.startsWith(`${normalizedBaseUrl}/`);
  };
  const forwardToGin = (req: IncomingMessage, res: ServerResponse) => {
    const proxyReq = request(
      {
        hostname: "127.0.0.1",
        port: serverConfig.ginPort,
        path: req.url ?? "/",
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${serverConfig.ginPort}`,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on("error", (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      res.statusCode = 502;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "Bad Gateway", message }));
    });

    req.pipe(proxyReq);
  };

  // Proxy target should point to backend origin only.
  // The matched route prefix (e.g. /api-go/v1, /ws-go) is preserved by proxy itself.
  // If target also appends basePath, final upstream path becomes duplicated and can
  // break websocket upgrades with ECONNRESET.
  const buildTarget = (): string => `http://127.0.0.1:${serverConfig.ginPort}`;
  const defaultProxyBasePaths = ["/api", "/ws"];
  const normalizePathPrefix = (value: string) => {
    const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
    return withLeadingSlash.endsWith("/") && withLeadingSlash.length > 1
      ? withLeadingSlash.slice(0, -1)
      : withLeadingSlash;
  };
  const normalizedProxyBasePaths = [
    ...(proxyBasePaths ?? defaultProxyBasePaths),
    ...(wsProxyBasePaths ?? []),
  ]
    .map(normalizePathPrefix)
    .filter((item, index, list) => list.indexOf(item) === index);
  const wsProxyPathSet = new Set((wsProxyBasePaths ?? ["/ws"]).map(normalizePathPrefix));
  const viteProxy = normalizedProxyBasePaths.reduce(
    (acc, pathPrefix) => {
      acc[pathPrefix] = {
        target: buildTarget(),
        changeOrigin: true,
        ws: wsProxyPathSet.has(pathPrefix),
      };
      return acc;
    },
    {} as Record<string, { target: string; changeOrigin: boolean; ws: boolean }>,
  );

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
    vite: {
      server: {
        proxy: viteProxy,
      },
      // 配置 Vite 插件
      plugins: [
        {
          name: "nuxt-gin-base-url-proxy",
          configureServer(server: {
            middlewares: {
              use: (
                fn: (
                  req: IncomingMessage & { url?: string },
                  res: ServerResponse,
                  next: () => void,
                ) => void,
              ) => void;
            };
          }) {
            server.middlewares.use((req, res, next) => {
              const requestPath = (req.url ?? "/").split("?")[0] || "/";
              // Vite 内部请求交给 Nuxt/Vite 自己处理，其它非 baseUrl 请求转发到 Gin。
              if (!isViteInternalRequest(requestPath) && !isBaseUrlRequest(requestPath)) {
                forwardToGin(req, res);
                return;
              }
              next();
            });
          },
        },
      ],
      // 配置 esbuild 编译器的选项
      // 设置 jsxFactory 为 "h"，这是 Vue 3 中用于创建虚拟 DOM 的函数
      // 设置 jsxFragment 为 "Fragment"，用于处理 JSX 中的片段
      esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
    },
  };
}
