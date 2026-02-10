import { request, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";

export interface ServerConfigJson {
  /** 前端基础 URL */
  baseUrl: string;
  /** Nuxt 开发端口 */
  nuxtPort: number;
  /** Gin 服务端口 */
  ginPort: number;
}

export interface MyNuxtConfig {
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

function forwardToGin(ginPort: number, req: IncomingMessage, res: ServerResponse): void {
  const proxyReq = request(
    {
      hostname: "127.0.0.1",
      port: ginPort,
      path: req.url ?? "/",
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${ginPort}`,
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
}

function forwardWebSocketToGin(
  ginPort: number,
  req: IncomingMessage,
  clientSocket: Socket,
  clientHead: Buffer,
): void {
  const proxyReq = request({
    hostname: "127.0.0.1",
    port: ginPort,
    path: req.url ?? "/",
    method: req.method ?? "GET",
    headers: {
      ...req.headers,
      host: `127.0.0.1:${ginPort}`,
      connection: "Upgrade",
    },
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode ?? 101} ${proxyRes.statusMessage ?? "Switching Protocols"}\r\n`;
    const headers = proxyRes.rawHeaders;
    let headerText = "";
    for (let i = 0; i < headers.length; i += 2) {
      headerText += `${headers[i]}: ${headers[i + 1]}\r\n`;
    }
    clientSocket.write(`${statusLine}${headerText}\r\n`);

    if (clientHead.length > 0) {
      proxySocket.write(clientHead);
    }
    if (proxyHead.length > 0) {
      clientSocket.write(proxyHead);
    }

    proxySocket.pipe(clientSocket).pipe(proxySocket);
  });

  proxyReq.on("error", () => {
    if (!clientSocket.destroyed) {
      clientSocket.destroy();
    }
  });

  proxyReq.end();
}

/**
 * 创建默认的 Nuxt 配置。
 */
export function createDefaultConfig({
  serverConfig,
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
            httpServer?: {
              on: (
                event: "upgrade",
                listener: (
                  req: IncomingMessage,
                  socket: Socket,
                  head: Buffer,
                ) => void,
              ) => void;
            };
          }) {
            server.middlewares.use((req, res, next) => {
              const requestPath = (req.url ?? "/").split("?")[0] || "/";
              const shouldForward =
                !isViteInternalRequest(requestPath) && !isBaseUrlRequest(baseUrl, requestPath);

              if (shouldForward) {
                forwardToGin(serverConfig.ginPort, req, res);
                return;
              }

              next();
            });

            if (server.httpServer) {
              server.httpServer.on("upgrade", (req, socket, head) => {
                const requestPath = (req.url ?? "/").split("?")[0] || "/";
                const shouldForward =
                  !isViteInternalRequest(requestPath) && !isBaseUrlRequest(baseUrl, requestPath);

                if (shouldForward) {
                  forwardWebSocketToGin(serverConfig.ginPort, req, socket, head);
                }
              });
            }
          },
        },
      ],
      esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
    },
  };
}
