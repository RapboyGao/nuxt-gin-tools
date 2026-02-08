import concurrently from "concurrently";
import { existsSync, readJSONSync, ensureDirSync } from "fs-extra";
import { join } from "path";
import cleanUp from "./cleanup";
import postInstall from "./postinstall";
import { startGoDev } from "./dev-go";
import { killPorts } from "./utils";

const cwd = process.cwd();
const serverConfig = readJSONSync(join(cwd, "server.config.json"));

/**
 * 启动本地开发环境。
 *
 * 行为包括：按配置执行预清理、释放开发端口、并行启动 Nuxt 与 Go 监听流程。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function develop() {
  const cleanupBeforeDevelop = serverConfig.cleanupBeforeDevelop === true;
  const killPortBeforeDevelop = serverConfig.killPortBeforeDevelop !== false;

  // 如果配置为开发前清理，则直接执行清理和安装后处理
  if (cleanupBeforeDevelop) {
    await cleanUp();
    await postInstall();
  } else {
    // 否则仅在关键依赖缺失时执行
    if (!existsSync(join(cwd, "vue/.nuxt")) || !existsSync(join(cwd, "go.sum"))) {
      await cleanUp();
      await postInstall();
    }
  }
  // 在开发前确保占用端口被释放
  if (killPortBeforeDevelop) {
    killPorts([serverConfig.ginPort, serverConfig.nuxtPort]);
  }
  ensureDirSync(join(cwd, ".build/.server"));
  // Nuxt 保持在 concurrently 中运行，统一复用 nuxt 标签输出。
  const nuxtTask = concurrently([
    {
      command: `npx nuxt dev --port=${serverConfig.nuxtPort} --host`,
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;

  // Go 侧直接调用本地 dev-go 逻辑，避免额外 shell 路径和引号问题。
  await Promise.all([startGoDev(), nuxtTask]);
}

export default develop;
