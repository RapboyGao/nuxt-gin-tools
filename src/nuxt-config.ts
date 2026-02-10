import type { IncomingMessage, ServerResponse } from "node:http";

export interface ServerConfigJson {
  /** 前端基础 URL */
  baseUrl: string;
  /** Nuxt 开发端口 */
  nuxtPort: number;
  /** Gin 服务端口 */
  ginPort: number;
}

export interface MyNuxtConfig {
  /**
   * 开发期是否将访问 Nuxt 端口（baseUrl 下的页面请求）重定向到 Gin 端口。
   * 默认 true。
   */
  redirectNuxtToGinInDev?: boolean;
  /** 服务器配置 */
  serverConfig: ServerConfigJson;
}

function normalizePathPrefix(value: string): string {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  if (withLeadingSlash !== "/" && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function normalizeBaseUrl(value: string): string {
  return normalizePathPrefix(value || "/");
}

function isViteInternalRequest(requestPath: string): boolean {
  return (
    requestPath.startsWith("/@vite") ||
    requestPath.startsWith("/__vite") ||
    requestPath.startsWith("/node_modules/") ||
    requestPath.startsWith("/@id/")
  );
}

function isBaseUrlRequest(baseUrl: string, requestPath: string): boolean {
  if (baseUrl === "/") {
    return true;
  }
  return requestPath === baseUrl || requestPath.startsWith(`${baseUrl}/`);
}

/**
 * 创建默认的 Nuxt 配置。
 */
export function createDefaultConfig({
  serverConfig,
  redirectNuxtToGinInDev = true,
}: MyNuxtConfig) {
  const baseUrl = normalizeBaseUrl(serverConfig.baseUrl);

  return {
    buildDir: "vue/.nuxt",
    srcDir: "vue",
    ssr: false,
    experimental: {
      payloadExtraction: false,
    },
    devtools: {
      timeline: {
        enabled: true,
      },
    },
    app: { baseURL: serverConfig.baseUrl },
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
      server: {},
      plugins: [
        {
          name: "nuxt-gin-base-url-redirect",
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
              const requestUrl = req.url ?? "/";
              const requestPath = requestUrl.split("?")[0] || "/";
              const method = req.method ?? "GET";
              const acceptsHtml =
                typeof req.headers.accept === "string" &&
                req.headers.accept.includes("text/html");

              if (
                redirectNuxtToGinInDev === true &&
                !isViteInternalRequest(requestPath) &&
                isBaseUrlRequest(baseUrl, requestPath) &&
                (method === "GET" || method === "HEAD") &&
                acceptsHtml
              ) {
                res.statusCode = 307;
                res.setHeader("Location", `http://127.0.0.1:${serverConfig.ginPort}${requestUrl}`);
                res.end();
                return;
              }
              next();
            });
          },
        },
      ],
      esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
    },
  };
}
