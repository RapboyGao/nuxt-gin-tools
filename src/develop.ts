import concurrently from "concurrently";
import { existsSync, readJSONSync, ensureDirSync } from "fs-extra";
import os from "os";
import { join } from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import cleanUp from "./cleanup";
import postInstall from "./postinstall";

const cwd = process.cwd();
const serverConfig = readJSONSync(join(cwd, "server.config.json"));

function getGoDevCommand() {
  const scriptPath = join(__dirname, "dev-go.js");
  return `"${process.execPath}" "${scriptPath}"`;
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
        console.log(
          chalk.yellow(`Killed process ${pid} on port ${port} (unix)`),
        );
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
        console.log(
          chalk.yellow(`Killed process ${pid} on port ${port} (win32)`),
        );
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
    killPortsFromConfig();
  }
  ensureDirSync(join(cwd, ".build/.server"));
  await concurrently([
    {
      command: getGoDevCommand(),
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
