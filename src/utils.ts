import { execSync } from "child_process";
import chalk from "chalk";
import os from "os";

type KillPortOptions = {
  logPrefix?: string;
  portLabel?: string;
};

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0;
}

function buildMessage(pid: number, port: number, platform: string, options?: KillPortOptions): string {
  const prefix = options?.logPrefix ? `[${options.logPrefix}] ` : "";
  const label = options?.portLabel ?? "port";
  return `${prefix}killed process ${pid} on ${label} ${port} (${platform})`;
}

function killPortUnix(port: number, options?: KillPortOptions) {
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
        console.log(chalk.green(buildMessage(pid, port, "unix", options)));
      } catch {
        // Best-effort: if the process is already gone, ignore.
      }
    }
  } catch {
    // Best-effort: lsof might be missing or no process is listening on the port.
  }
}

function killPortWindows(port: number, options?: KillPortOptions) {
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
        console.log(chalk.green(buildMessage(pid, port, "win32", options)));
      } catch {
        // Best-effort: if the process is already gone, ignore.
      }
    }
  } catch {
    // Best-effort: netstat might be missing or no process is listening on the port.
  }
}

export function killPort(port: number, options?: KillPortOptions) {
  if (!isValidPort(port)) {
    return;
  }
  if (os.platform() === "win32") {
    killPortWindows(port, options);
    return;
  }
  killPortUnix(port, options);
}

export function killPorts(ports: Array<number | undefined>, options?: KillPortOptions) {
  const validPorts = ports
    .filter((port): port is number => typeof port === "number" && isValidPort(port))
    .filter((port, index, list) => list.indexOf(port) === index);
  for (const port of validPorts) {
    killPort(port, options);
  }
}
