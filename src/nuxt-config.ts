import type { NuxtConfig } from "nuxt/config";
import { readJSONSync } from "fs-extra";
import { resolve } from "path";

const cwd = process.cwd();
const serverConfig = readJSONSync(resolve(cwd, `server.config.json`)) as ServerConfig;

/** API配置模式接口 */
export interface ServerConfig {
  /** Gin框架端口 */
  ginPort: number;
  /** Nuxt框架devServer端口 */
  nuxtPort: number;
  /** Nuxt的BaseUrl，必须以/开头并包含至少一个单词字符 */
  baseUrl: string;
}

export const config: NuxtConfig = {
  nitro: { devProxy: { "/api-go": { target: `http://localhost:${serverConfig.ginPort}/api-go`, changeOrigin: true } } },
  vite: {
    esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
  },
  rootDir: "vue",
  ssr: false,
  app: { baseURL: serverConfig.baseUrl },
  devServer: { port: serverConfig.nuxtPort },
  experimental: { payloadExtraction: false },
};

export default config;
