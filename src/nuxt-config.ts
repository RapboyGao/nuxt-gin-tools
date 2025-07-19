import { readJSONSync } from "fs-extra";
import { resolve } from "path";
// @ts-ignore
import { BASE_PATH } from "../../../vue/composables/api/api";

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

/**
 * 处理基础路径，去除协议和域名部分，只保留路径部分
 * 例如，将 "https://example.com/api-go" 转换为 "/api-go"
 *
 */
const thisBasePath = BASE_PATH.replace(/^https?:[/]{2}[^/]+/, "");

/**
 * 定义代理目标 URL
 * 拼接本地服务器的地址和处理后的基础路径，用于开发环境的代理
 * 例如，当 Gin 服务器端口为 8099 时，目标 URL 可能为 "http://localhost:8099/api-go"
 */
const target = `http://localhost:${serverConfig.ginPort}${thisBasePath}`;

export const config = {
  ssr: false,
  app: { baseURL: serverConfig.baseUrl },
  devServer: { port: serverConfig.nuxtPort },
  experimental: { payloadExtraction: false },

  nitro: {
    devProxy: {
      [thisBasePath]: { target, changeOrigin: true },
    },
  },
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

export default config;
