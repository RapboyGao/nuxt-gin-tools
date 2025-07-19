import os from "os";
import { readJSONSync } from "fs-extra";
import { join } from "path";
import concurrently from "concurrently";

const cwd = process.cwd();
const serverConfig = readJSONSync(join(cwd, "server.config.json"));

export function develop() {
  // 如果是macOS
  if (os.platform() === "darwin") {
    // 如果是macOS，使用open命令打开浏览器
    concurrently([`nuxt dev --port=${serverConfig.nuxtPort}`, "~/go/bin/air"]);
  } else {
    concurrently([`nuxt dev --port=${serverConfig.nuxtPort}`, "air"]);
  }
}

export default develop;
