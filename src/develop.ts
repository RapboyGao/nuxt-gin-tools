import concurrently from "concurrently";
import { existsSync, readJSONSync } from "fs-extra";
import os from "os";
import { join } from "path";
import cleanUp from "./cleanup";
import postInstall from "./postinstall";

const cwd = process.cwd();
const serverConfig = readJSONSync(join(cwd, "server.config.json"));
/**
 *
 * @returns {string} 返回air命令的路径
 * 根据操作系统不同，返回不同的路径
 * 如果是macOS，返回~/go/bin/air
 * 如果是其他操作系统，返回air
 */
function getAirCommand() {
  if (os.platform() === "darwin") {
    return "~/go/bin/air";
  } else {
    return "air";
  }
}

export async function develop() {
  // 如果不存在 .nuxt 目录或 go.sum 文件，则执行清理和安装后处理
  // 这可以确保开发环境干净且依赖正确
  if (!existsSync(join(cwd, "vue/.nuxt")) || !existsSync(join(cwd, "go.sum"))) {
    await cleanUp();
    await postInstall();
  }
  await concurrently([
    {
      command: getAirCommand(),
      name: "go",
      prefixColor: "green",
    },
    {
      command: `npx nuxt dev --port=${serverConfig.nuxtPort}`,
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;
}

export default develop;
