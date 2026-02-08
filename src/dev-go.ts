import { spawn, type ChildProcess } from "child_process";
import { execSync } from "child_process";
import chokidar from "chokidar";
import chalk from "chalk";
import { existsSync, readFileSync, readJSONSync } from "fs-extra";
import os from "os";
import { extname, isAbsolute, join, relative, resolve } from "path";

const cwd = process.cwd();
const RESTART_DEBOUNCE_MS = 150;
const SHUTDOWN_TIMEOUT_MS = 2000;
const LOG_TAG = "go-watch";
const serverConfigPath = join(cwd, "server.config.json");
const ginPort = getGinPort();

type GoWatchConfig = {
  includeExt: Set<string>;
  includeDir: string[];
  includeFile: Set<string>;
  excludeDir: string[];
  excludeFile: Set<string>;
  excludeRegex: RegExp[];
  tmpDir: string;
  testDataDir: string;
};

type GoWatchConfigInput = {
  includeExt?: unknown;
  include_ext?: unknown;
  includeDir?: unknown;
  include_dir?: unknown;
  includeFile?: unknown;
  include_file?: unknown;
  excludeDir?: unknown;
  exclude_dir?: unknown;
  excludeFile?: unknown;
  exclude_file?: unknown;
  excludeRegex?: unknown;
  exclude_regex?: unknown;
  tmpDir?: unknown;
  tmp_dir?: unknown;
  testDataDir?: unknown;
  testdata_dir?: unknown;
};

type ServerConfig = {
  ginPort?: number;
};

function getGinPort(): number | null {
  if (!existsSync(serverConfigPath)) {
    return null;
  }
  try {
    const serverConfig = readJSONSync(serverConfigPath) as ServerConfig;
    if (Number.isInteger(serverConfig.ginPort) && (serverConfig.ginPort as number) > 0) {
      return serverConfig.ginPort as number;
    }
  } catch {
    // best effort
  }
  return null;
}

function killPortUnix(port: number) {
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
        console.log(chalk.yellow(`[${LOG_TAG}] killed process ${pid} on ginPort ${port} (unix)`));
      } catch {
        // best effort
      }
    }
  } catch {
    // best effort
  }
}

function killPortWindows(port: number) {
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
        console.log(chalk.yellow(`[${LOG_TAG}] killed process ${pid} on ginPort ${port} (win32)`));
      } catch {
        // best effort
      }
    }
  } catch {
    // best effort
  }
}

function killGinPortIfNeeded() {
  if (!ginPort) {
    return;
  }
  if (os.platform() === "win32") {
    killPortWindows(ginPort);
    return;
  }
  killPortUnix(ginPort);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function toProjectRelative(filePath: string): string {
  const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  return normalizePath(relative(cwd, abs));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toStringValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function loadWatchConfig(): GoWatchConfig {
  const defaultConfig: GoWatchConfig = {
    includeExt: new Set(["go"]),
    includeDir: [],
    includeFile: new Set(),
    excludeDir: [".git", "node_modules", "vendor", "vue"],
    excludeFile: new Set(),
    excludeRegex: [/_test\.go$/],
    tmpDir: ".build/.server",
    testDataDir: "testdata",
  };

  const candidates = [
    process.env.NUXT_GIN_WATCH_CONFIG,
    join(cwd, "node_modules/nuxt-gin-tools/.go-watch.json"),
    join(cwd, ".go-watch.json"),
    join(__dirname, "..", ".go-watch.json"),
    join(__dirname, "..", "..", ".go-watch.json"),
  ].filter((item): item is string => Boolean(item));

  const configPath = candidates.find((item) => existsSync(item));
  if (!configPath) {
    return defaultConfig;
  }

  let parsedConfig: GoWatchConfigInput = {};
  try {
    parsedConfig = JSON.parse(readFileSync(configPath, "utf-8")) as GoWatchConfigInput;
  } catch {
    console.warn(
      chalk.yellow(`[${LOG_TAG}] invalid watch config JSON, fallback to defaults: ${configPath}`),
    );
    return defaultConfig;
  }

  const includeExt = toStringArray(parsedConfig.includeExt ?? parsedConfig.include_ext)
    .map((item) => item.replace(/^\./, ""))
    .filter((item) => /^[a-zA-Z0-9]+$/.test(item));

  const includeDir = toStringArray(parsedConfig.includeDir ?? parsedConfig.include_dir)
    .map((item) => normalizePath(item))
    .filter(Boolean);

  const includeFile = toStringArray(parsedConfig.includeFile ?? parsedConfig.include_file)
    .map((item) => normalizePath(item))
    .filter(Boolean);

  const excludeDir = toStringArray(parsedConfig.excludeDir ?? parsedConfig.exclude_dir)
    .map((item) => normalizePath(item))
    .filter(Boolean);

  const excludeFile = toStringArray(parsedConfig.excludeFile ?? parsedConfig.exclude_file)
    .map((item) => normalizePath(item))
    .filter(Boolean);

  const excludeRegex = toStringArray(parsedConfig.excludeRegex ?? parsedConfig.exclude_regex)
    .map((item) => {
      try {
        return new RegExp(item);
      } catch {
        return null;
      }
    })
    .filter((item): item is RegExp => item instanceof RegExp);

  const tmpDir = normalizePath(
    toStringValue(parsedConfig.tmpDir ?? parsedConfig.tmp_dir) || defaultConfig.tmpDir,
  );
  const testdataDir = normalizePath(
    toStringValue(parsedConfig.testDataDir ?? parsedConfig.testdata_dir) ||
      defaultConfig.testDataDir,
  );

  return {
    includeExt: new Set(includeExt.length ? includeExt : [...defaultConfig.includeExt]),
    includeDir,
    includeFile: new Set(includeFile),
    excludeDir: [...new Set([...defaultConfig.excludeDir, ...excludeDir, tmpDir, testdataDir])],
    excludeFile: new Set(excludeFile),
    excludeRegex: excludeRegex.length ? excludeRegex : defaultConfig.excludeRegex,
    tmpDir,
    testDataDir: testdataDir,
  };
}

function pathInDir(relPath: string, dir: string): boolean {
  const normalizedDir = normalizePath(dir).replace(/\/+$/, "");
  return relPath === normalizedDir || relPath.startsWith(`${normalizedDir}/`);
}

function shouldIgnore(relPath: string, config: GoWatchConfig): boolean {
  if (!relPath || relPath === ".") {
    return false;
  }
  if (config.excludeFile.has(relPath)) {
    return true;
  }
  if (config.excludeDir.some((dir) => pathInDir(relPath, dir))) {
    return true;
  }
  return config.excludeRegex.some((reg) => reg.test(relPath));
}

function shouldTrigger(relPath: string, config: GoWatchConfig): boolean {
  if (shouldIgnore(relPath, config)) {
    return false;
  }

  const ext = extname(relPath).replace(/^\./, "");
  const inIncludedFile = config.includeFile.has(relPath);

  if (config.includeDir.length > 0) {
    const inIncludedDir = config.includeDir.some((dir) => pathInDir(relPath, dir));
    if (!inIncludedDir && !inIncludedFile) {
      return false;
    }
  }

  if (inIncludedFile) {
    return true;
  }

  if (!ext) {
    return false;
  }

  return config.includeExt.has(ext);
}

function quote(arg: string): string {
  if (/\s/.test(arg)) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return arg;
}

function runGoProcess(): ChildProcess {
  const command = `go run ${quote("main.go")}`;
  killGinPortIfNeeded();
  console.log(chalk.green(`[${LOG_TAG}] start: ${command}`));
  return spawn(command, {
    cwd,
    shell: true,
    stdio: "inherit",
  });
}

async function stopGoProcess(proc: ChildProcess | null): Promise<void> {
  if (!proc || proc.killed || proc.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolveStop) => {
    let finished = false;
    const done = () => {
      if (finished) {
        return;
      }
      finished = true;
      resolveStop();
    };

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // best effort
      }
      done();
    }, SHUTDOWN_TIMEOUT_MS);

    proc.once("exit", () => {
      clearTimeout(timer);
      done();
    });

    try {
      proc.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      done();
    }
  });
}

/**
 * 启动 Go 开发监听流程：执行 `go run main.go`，并在文件变更后自动重启。
 *
 * 该函数通常由 `develop()` 调用；执行后会持续监听，直到收到退出信号。
 *
 * @returns {Promise<void>} 仅在监听流程被中断并完成清理后返回。
 */
export async function startGoDev() {
  const watchConfig = loadWatchConfig();
  const watchRoots = watchConfig.includeDir.length
    ? watchConfig.includeDir.map((dir) => join(cwd, dir))
    : [cwd];

  console.log(
    chalk.cyan(
      `[${LOG_TAG}] watching: ${watchRoots.map((item) => toProjectRelative(item)).join(", ")}`,
    ),
  );

  let restarting = false;
  let goProc: ChildProcess | null = runGoProcess();
  let restartTimer: NodeJS.Timeout | null = null;

  const watcher = chokidar.watch(watchRoots, {
    ignoreInitial: true,
    ignored: (pathName) => shouldIgnore(toProjectRelative(pathName), watchConfig),
    awaitWriteFinish: {
      stabilityThreshold: 120,
      pollInterval: 20,
    },
  });

  const triggerRestart = (eventName: string, changedPath: string) => {
    const relPath = toProjectRelative(changedPath);
    if (!shouldTrigger(relPath, watchConfig)) {
      return;
    }

    if (restartTimer) {
      clearTimeout(restartTimer);
    }

    restartTimer = setTimeout(async () => {
      if (restarting) {
        return;
      }
      restarting = true;
      console.log(chalk.yellow(`[${LOG_TAG}] ${eventName}: ${relPath}, restarting...`));
      await stopGoProcess(goProc);
      goProc = runGoProcess();
      restarting = false;
    }, RESTART_DEBOUNCE_MS);
  };

  watcher
    .on("add", (filePath) => triggerRestart("add", filePath))
    .on("change", (filePath) => triggerRestart("change", filePath))
    .on("unlink", (filePath) => triggerRestart("unlink", filePath))
    .on("error", (error) => {
      console.error(chalk.red(`[${LOG_TAG}] watcher error: ${String(error)}`));
    });

  const shutdown = async () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    await watcher.close();
    await stopGoProcess(goProc);
  };

  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
}

if (require.main === module) {
  // 兼容直接执行该文件（例如 node src/dev-go.js）。
  startGoDev().catch((error) => {
    console.error(chalk.red(`[${LOG_TAG}] failed to start: ${String(error)}`));
    process.exit(1);
  });
}
