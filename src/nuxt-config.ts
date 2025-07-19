import { readJSONSync } from "fs-extra";
import { resolve } from "path";
import type { NuxtConfig } from "nuxt/config";

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
  ssr: false,
  app: { baseURL: serverConfig.baseUrl },
  devServer: { port: serverConfig.nuxtPort },
  experimental: { payloadExtraction: false },

  vite: {
    esbuild: { jsxFactory: "h", jsxFragment: "Fragment" },
  },
  rootDir: "vue",

  devtools: {
    timeline: {
      enabled: true,
    },
  },
};

export function getServerConfig(nitro: NuxtConfig["nitro"]): NuxtConfig {
  return {
    ...config,
    nitro,
  };
}
export default getServerConfig;
