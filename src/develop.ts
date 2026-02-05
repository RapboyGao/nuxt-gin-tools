import concurrently from "concurrently";
import { existsSync, readJSONSync, ensureDirSync } from "fs-extra";
import os from "os";
import { join } from "path";
import { execSync } from "child_process";
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
    return "~/go/bin/air -c node_modules/nuxt-gin-tools/.air.toml";
  } else {
    return "air -c node_modules/nuxt-gin-tools/.air.toml";
  }
}

function killPort(port: number) {
  if (!Number.isInteger(port)) {
    return;
  }
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!output) {
      return;
    }
    const pids = output
      .split("\n")
      .map((pid) => Number(pid.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Best-effort: if the process is already gone, ignore.
      }
    }
  } catch {
    // Best-effort: lsof might be missing or no process is listening on the port.
  }
}

function killPortWindows(port: number) {
  if (!Number.isInteger(port)) {
    return;
  }
  try {
    const output = execSync(`netstat -ano -p tcp`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!output) {
      return;
    }
    const pids = new Set<number>();
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("TCP")) {
        continue;
      }
      const parts = trimmed.split(/\s+/);
      if (parts.length < 5) {
        continue;
      }
      const localAddress = parts[1];
      const pid = Number(parts[parts.length - 1]);
      const match = localAddress.match(/:(\d+)$/);
      if (!match) {
        continue;
      }
      const localPort = Number(match[1]);
      if (localPort === port && Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, {
          stdio: ["ignore", "ignore", "ignore"],
        });
      } catch {
        // Best-effort: if the process is already gone, ignore.
      }
    }
  } catch {
    // Best-effort: netstat might be missing or no process is listening on the port.
  }
}

function killPortsFromConfig() {
  const ports = [serverConfig.ginPort, serverConfig.nuxtPort]
    .filter((port) => Number.isInteger(port) && port > 0)
    .filter((port, index, list) => list.indexOf(port) === index);
  for (const port of ports) {
    if (os.platform() === "win32") {
      killPortWindows(port);
    } else {
      killPort(port);
    }
  }
}

export async function develop() {
  // 如果不存在 .nuxt 目录或 go.sum 文件，则执行清理和安装后处理
  // 这可以确保开发环境干净且依赖正确
  if (!existsSync(join(cwd, "vue/.nuxt")) || !existsSync(join(cwd, "go.sum"))) {
    await cleanUp();
    await postInstall();
  }
  // 在开发前确保占用端口被释放
  killPortsFromConfig();
  ensureDirSync(join(cwd, ".build/.server"));
  await concurrently([
    {
      command: getAirCommand(),
      name: "go",
      prefixColor: "green",
    },
    {
      command: `npx nuxt dev --port=${serverConfig.nuxtPort} --host`,
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;
}

export default develop;
