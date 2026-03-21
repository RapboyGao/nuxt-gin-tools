import { spawn, type ChildProcess } from "child_process";
import chokidar from "chokidar";
import { existsSync, readFileSync } from "fs-extra";
import { extname, isAbsolute, join, relative, resolve } from "path";
import { readLegacyServerConfig } from "../nuxt-gin";
import { killPort } from "../system/ports";
import { printCommandError, printCommandLog, printCommandWarn } from "../cli/terminal-ui";

const cwd = process.cwd();
const RESTART_DEBOUNCE_MS = 150;
const SHUTDOWN_TIMEOUT_MS = 2000;
const LOG_TAG = "go-watch";
const GO_WATCH_PREFIX = `[${LOG_TAG}]`;

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

function getGinPort(): number | null {
  const ginPort = readLegacyServerConfig()?.ginPort;
  if (Number.isInteger(ginPort) && (ginPort as number) > 0) {
    return ginPort as number;
  }
  if (!existsSync(join(cwd, "server.config.json"))) {
    printCommandWarn("[config] server.config.json not found; Go watcher will start without port cleanup");
  }
  return null;
}

function killGinPortIfNeeded(ginPort: number | null) {
  if (!ginPort) {
    return;
  }
  killPort(ginPort, { logPrefix: LOG_TAG, portLabel: "ginPort" });
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
    printCommandWarn(
      `${GO_WATCH_PREFIX} invalid watch config JSON, fallback to defaults: ${configPath}`,
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

function runGoProcess(ginPort: number | null): ChildProcess {
  const command = `go run ${quote("main.go")}`;
  killGinPortIfNeeded(ginPort);
  printCommandLog(GO_WATCH_PREFIX, `start: ${command}`);
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
export async function startGoDev(ginPortOverride?: number | null) {
  const watchConfig = loadWatchConfig();
  const ginPort = ginPortOverride ?? getGinPort();
  const watchRoots = watchConfig.includeDir.length
    ? watchConfig.includeDir.map((dir) => join(cwd, dir))
    : [cwd];

  printCommandLog(
    GO_WATCH_PREFIX,
    `watching: ${watchRoots.map((item) => toProjectRelative(item)).join(", ")}`,
  );

  let restarting = false;
  let goProc: ChildProcess | null = runGoProcess(ginPort);
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
      printCommandLog(GO_WATCH_PREFIX, `${eventName}: ${relPath}, restarting...`);
      await stopGoProcess(goProc);
      goProc = runGoProcess(ginPort);
      restarting = false;
    }, RESTART_DEBOUNCE_MS);
  };

  watcher
    .on("add", (filePath) => triggerRestart("add", filePath))
    .on("change", (filePath) => triggerRestart("change", filePath))
    .on("unlink", (filePath) => triggerRestart("unlink", filePath))
    .on("error", (error) => {
      printCommandError(`${GO_WATCH_PREFIX} watcher error`, error);
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
    printCommandError(`${GO_WATCH_PREFIX} failed to start`, error);
    process.exit(1);
  });
}
