import concurrently from "concurrently";
import { existsSync, readJSONSync, ensureDirSync } from "fs-extra";
import { join } from "path";
import cleanUp from "./cleanup";
import postInstall from "./postinstall";
import { startGoDev } from "./dev-go";
import { killPorts } from "../src/utils";

const cwd = process.cwd();
const serverConfig = readJSONSync(join(cwd, "server.config.json"));

async function prepareDevelop() {
  const cleanupBeforeDevelop = serverConfig.cleanupBeforeDevelop === true;
  if (cleanupBeforeDevelop) {
    await cleanUp();
    await postInstall();
    return;
  }
  if (!existsSync(join(cwd, "vue/.nuxt")) || !existsSync(join(cwd, "go.sum"))) {
    await cleanUp();
    await postInstall();
  }
}

async function runNuxtDev() {
  await concurrently([
    {
      command: `npx nuxt dev --port=${serverConfig.nuxtPort} --host`,
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;
}

async function runGoDev() {
  ensureDirSync(join(cwd, ".build/.server"));
  await startGoDev();
}

/**
 * 启动本地开发环境。
 *
 * 行为包括：按配置执行预清理、释放开发端口、并行启动 Nuxt 与 Go 监听流程。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function develop() {
  const killPortBeforeDevelop = serverConfig.killPortBeforeDevelop !== false;
  await prepareDevelop();
  // 在开发前确保占用端口被释放
  if (killPortBeforeDevelop) {
    killPorts([serverConfig.ginPort, serverConfig.nuxtPort]);
  }
  await Promise.all([runGoDev(), runNuxtDev()]);
}

/**
 * 仅启动 Nuxt 开发服务（带 nuxt 标签输出）。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function developNuxt() {
  const killPortBeforeDevelop = serverConfig.killPortBeforeDevelop !== false;
  await prepareDevelop();
  if (killPortBeforeDevelop) {
    killPorts([serverConfig.nuxtPort]);
  }
  await runNuxtDev();
}

/**
 * 仅启动 Go 开发监听流程。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function developGo() {
  const killPortBeforeDevelop = serverConfig.killPortBeforeDevelop !== false;
  await prepareDevelop();
  if (killPortBeforeDevelop) {
    killPorts([serverConfig.ginPort]);
  }
  await runGoDev();
}

export default develop;
