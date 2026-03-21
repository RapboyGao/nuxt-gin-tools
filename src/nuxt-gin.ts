import * as FS from "fs-extra";
import * as Path from "path";
import type { CleanupOptions } from "./cli/commands/cleanup";
import type { DevelopOptions } from "./cli/commands/develop";
import type { PostInstallOptions } from "./cli/commands/install";
import type { UpdateOptions } from "./cli/commands/update";
import type { PackConfig } from "./pack";
import type { ServerConfigJson } from "./nuxt-config";

const { createJiti } = require("jiti");

export interface NuxtGinConfig {
  dev?: DevelopOptions & {
    cleanupBeforeDevelop?: boolean;
    killPortBeforeDevelop?: boolean;
  };
  install?: PostInstallOptions;
  cleanup?: CleanupOptions;
  update?: Partial<UpdateOptions>;
  pack?: PackConfig;
}

export type LoadedNuxtGinConfig = {
  config: NuxtGinConfig;
  sourcePath?: string;
  warnings: string[];
};

const NUXT_GIN_CONFIG_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.json");
const NUXT_GIN_CONFIG_TS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.ts");
const NUXT_GIN_CONFIG_JS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.js");
const NUXT_GIN_CONFIG_CJS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.cjs");
const NUXT_GIN_CONFIG_MJS_PATH = Path.resolve(process.cwd(), "nuxt-gin.config.mjs");
const LEGACY_SERVER_CONFIG_PATH = Path.resolve(process.cwd(), "server.config.json");

export function createNuxtGinConfig(config: NuxtGinConfig): NuxtGinConfig {
  return config;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeModuleExport(moduleValue: unknown): unknown {
  if (isPlainObject(moduleValue) && "default" in moduleValue) {
    return (moduleValue as { default: unknown }).default;
  }
  return moduleValue;
}

function loadConfigModule(configPath: string): unknown {
  if (configPath.endsWith(".json")) {
    return FS.readJSONSync(configPath);
  }

  const jiti = createJiti(__filename, { moduleCache: false, interopDefault: true });
  return jiti(configPath);
}

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

function validateNuxtGinConfig(config: unknown, sourcePath: string): NuxtGinConfig {
  if (!isPlainObject(config)) {
    throw new Error(`${Path.basename(sourcePath)} must export an object`);
  }
  return config as NuxtGinConfig;
}

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

export function readLegacyServerConfig(): ServerConfigJson | undefined {
  if (!FS.existsSync(LEGACY_SERVER_CONFIG_PATH)) {
    return undefined;
  }
  return validateServerConfig(
    FS.readJSONSync(LEGACY_SERVER_CONFIG_PATH),
    Path.basename(LEGACY_SERVER_CONFIG_PATH),
  );
}

export function resolveNuxtGinProjectConfig(): LoadedNuxtGinConfig {
  const loaded = loadNuxtGinConfig();
  return {
    config: loaded?.config ?? {},
    sourcePath: loaded?.sourcePath,
    warnings: loaded?.warnings ?? [],
  };
}

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
