import * as FS from "fs-extra";
import * as Path from "path";
import type { CleanupOptions } from "./cli/commands/cleanup";
import type { DevelopOptions } from "./cli/commands/develop";
import type { PostInstallOptions } from "./cli/commands/install";
import type { UpdateOptions } from "./cli/commands/update";
import type { PackConfig } from "./pack";
import type { ServerConfigJson } from "./nuxt-config";

const { createJiti } = require("jiti");

/**
 * Go watcher configurable defaults.
 * Go watcher 的可配置默认项。
 */
export type GoWatchListConfig = {
  /** File extensions. / 文件扩展名。 */
  ext?: string[];
  /** Directories. / 目录。 */
  dir?: string[];
  /** Individual files. / 单个文件。 */
  file?: string[];
  /** Regex patterns, mainly for exclude rules. / 正则模式，主要用于排除规则。 */
  regex?: string[];
};

export type GoWatchConfigOptions = {
  /** Include rules. / 包含规则。 */
  include?: Omit<GoWatchListConfig, "regex">;
  /** Exclude rules. / 排除规则。 */
  exclude?: GoWatchListConfig;
  /** Temporary output directory. / 临时输出目录。 */
  tmpDir?: string;
  /** Test data directory name. / 测试数据目录名称。 */
  testDataDir?: string;
  /** Deprecated flat include ext. / 兼容旧版：扁平 includeExt。 */
  includeExt?: string[];
  /** Deprecated flat include dir. / 兼容旧版：扁平 includeDir。 */
  includeDir?: string[];
  /** Deprecated flat include file. / 兼容旧版：扁平 includeFile。 */
  includeFile?: string[];
  /** Deprecated flat exclude dir. / 兼容旧版：扁平 excludeDir。 */
  excludeDir?: string[];
  /** Deprecated flat exclude file. / 兼容旧版：扁平 excludeFile。 */
  excludeFile?: string[];
  /** Deprecated flat exclude regex. / 兼容旧版：扁平 excludeRegex。 */
  excludeRegex?: string[];
};

/**
 * Unified project config consumed by `nuxt-gin-tools`.
 * `nuxt-gin-tools` 使用的统一项目配置。
 */
export interface NuxtGinConfig {
  /** CLI defaults for development commands. / 开发命令的默认配置。 */
  dev?: DevelopOptions & {
    /** Force cleanup/bootstrap before dev starts. / 开发前强制执行清理与初始化。 */
    cleanupBeforeDevelop?: boolean;
    /** Kill occupied ports before dev starts. / 开发前释放已占用端口。 */
    killPortBeforeDevelop?: boolean;
  };
  /** Built-in Go watcher defaults. / Go watcher 的内置默认规则。 */
  goWatch?: GoWatchConfigOptions;
  /** CLI defaults for install/bootstrap. / install 初始化命令的默认配置。 */
  install?: PostInstallOptions;
  /** CLI defaults for cleanup. / cleanup 命令的默认配置。 */
  cleanup?: CleanupOptions;
  /** CLI defaults for dependency updates. / 依赖更新命令的默认配置。 */
  update?: Partial<UpdateOptions>;
  /** CLI defaults for build/pack. / build 与 pack 的默认配置。 */
  pack?: PackConfig;
}

/**
 * Result of resolving `nuxt-gin.config.*`.
 * 解析 `nuxt-gin.config.*` 后得到的结果。
 */
export type LoadedNuxtGinConfig = {
  /** Parsed config object. / 解析后的配置对象。 */
  config: NuxtGinConfig;
  /** Selected config file path. / 实际选中的配置文件路径。 */
  sourcePath?: string;
  /** Non-fatal warnings collected during resolution. / 解析过程中收集到的非致命警告。 */
  warnings: string[];
};

const NUXT_GIN_CONFIG_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.json");
const NUXT_GIN_CONFIG_TS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.ts");
const NUXT_GIN_CONFIG_JS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.js");
const NUXT_GIN_CONFIG_CJS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.cjs");
const NUXT_GIN_CONFIG_MJS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.mjs");
const LEGACY_SERVER_CONFIG_PATH = Path.resolve(process.cwd(), "server.config.json");

/**
 * Identity helper for typed config authoring in `nuxt-gin.config.ts`.
 * 用于 `nuxt-gin.config.ts` 的类型化配置 helper。
 */
export function createNuxtGinConfig(config: NuxtGinConfig): NuxtGinConfig {
  return config;
}

/**
 * Narrow an unknown value to a plain object.
 * 将未知值收窄为普通对象。
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Unwrap default export from CJS/ESM loaded modules.
 * 解包通过 CJS/ESM 加载后的默认导出。
 */
function normalizeModuleExport(moduleValue: unknown): unknown {
  if (isPlainObject(moduleValue) && "default" in moduleValue) {
    return (moduleValue as { default: unknown }).default;
  }
  return moduleValue;
}

/**
 * Load config from JSON or executable module files.
 * 从 JSON 或可执行模块文件中加载配置。
 */
function loadConfigModule(configPath: string): unknown {
  if (configPath.endsWith(".json")) {
    return FS.readJSONSync(configPath);
  }

  const jiti = createJiti(__filename, { moduleCache: false, interopDefault: true });
  return jiti(configPath);
}

/**
 * Validate runtime server config that still lives in `server.config.json`.
 * 校验仍然保存在 `server.config.json` 中的运行时服务配置。
 */
function validateServerConfig(serverConfig: unknown, sourceLabel: string): ServerConfigJson {
  if (!isPlainObject(serverConfig)) {
    throw new Error(`${sourceLabel}: serverConfig must be an object`);
  }

  const { baseUrl, nuxtPort, ginPort } = serverConfig;
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new Error(`${sourceLabel}: serverConfig.baseUrl must be a non-empty string`);
  }
  if (!Number.isInteger(nuxtPort) || (nuxtPort as number) <= 0) {
    throw new Error(`${sourceLabel}: serverConfig.nuxtPort must be a positive integer`);
  }
  if (!Number.isInteger(ginPort) || (ginPort as number) <= 0) {
    throw new Error(`${sourceLabel}: serverConfig.ginPort must be a positive integer`);
  }

  return serverConfig as unknown as ServerConfigJson;
}

/**
 * Validate the top-level `nuxt-gin.config.*` shape.
 * 校验顶层 `nuxt-gin.config.*` 的结构。
 */
function validateNuxtGinConfig(config: unknown, sourcePath: string): NuxtGinConfig {
  if (!isPlainObject(config)) {
    throw new Error(`${Path.basename(sourcePath)} must export an object`);
  }
  return config as NuxtGinConfig;
}

/**
 * Load `nuxt-gin.config.*` from the current project root.
 * 从当前项目根目录加载 `nuxt-gin.config.*`。
 */
export function loadNuxtGinConfig(): LoadedNuxtGinConfig | undefined {
  const candidates = [
    NUXT_GIN_CONFIG_TS_PATH,
    NUXT_GIN_CONFIG_JS_PATH,
    NUXT_GIN_CONFIG_CJS_PATH,
    NUXT_GIN_CONFIG_MJS_PATH,
    NUXT_GIN_CONFIG_PATH,
  ].filter((configPath) => FS.existsSync(configPath));

  if (candidates.length === 0) {
    return undefined;
  }

  const warnings: string[] = [];
  if (candidates.length > 1) {
    warnings.push(
      `multiple nuxt-gin config files found (${candidates.map((item) => Path.basename(item)).join(", ")}); using ${Path.basename(candidates[0])}`,
    );
  }

  const selectedPath = candidates[0];
  const loadedConfig = normalizeModuleExport(loadConfigModule(selectedPath));

  return {
    config: validateNuxtGinConfig(loadedConfig, selectedPath),
    sourcePath: selectedPath,
    warnings,
  };
}

/**
 * Read and validate legacy runtime server config from `server.config.json`.
 * 从 `server.config.json` 读取并校验运行时服务配置。
 */
export function readLegacyServerConfig(): ServerConfigJson | undefined {
  if (!FS.existsSync(LEGACY_SERVER_CONFIG_PATH)) {
    return undefined;
  }
  return validateServerConfig(
    FS.readJSONSync(LEGACY_SERVER_CONFIG_PATH),
    Path.basename(LEGACY_SERVER_CONFIG_PATH),
  );
}

/**
 * Resolve the project config and always return a stable object shape.
 * 解析项目配置，并始终返回稳定的对象结构。
 */
export function resolveNuxtGinProjectConfig(): LoadedNuxtGinConfig {
  const loaded = loadNuxtGinConfig();
  return {
    config: loaded?.config ?? {},
    sourcePath: loaded?.sourcePath,
    warnings: loaded?.warnings ?? [],
  };
}

/**
 * Merge objects while ignoring `undefined` from the override side.
 * 合并对象时忽略 override 侧的 `undefined` 值。
 */
export function mergeDefined<T extends object>(
  base?: Partial<T>,
  override?: Partial<T>,
): T {
  const merged: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(override ?? {})) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

export default createNuxtGinConfig;
