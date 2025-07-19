import os from "os";
import { readJSONSync } from "fs-extra";
import { join } from "path";
import concurrently from "concurrently";

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

export function develop() {
  concurrently([
    {
      command: getAirCommand(),
      name: "go",
      prefixColor: "green",
    },
    {
      command: `nuxt dev --port=${serverConfig.nuxtPort}`,
      name: "nuxt",
      prefixColor: "blue",
    },
  ]);
}

export default develop;
