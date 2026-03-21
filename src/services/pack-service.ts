import build from "./build-service";
import * as Zip from "7zip-min";
import * as FS from "fs-extra";
import * as Path from "path";
import * as os from "os";
import fg from "fast-glob";
import { mergeDefined, readLegacyServerConfig, resolveNuxtGinProjectConfig } from "../nuxt-gin";
import type { PackConfig } from "../pack";
import {
  printCommandBanner,
  printCommandError,
  printCommandInfo,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../cli/terminal-ui";

const { createJiti } = require("jiti");

export function builtPath(relativePath: string): string {
  return Path.resolve(SERVER_PATH, relativePath);
}

export const ZIP_PATH = Path.resolve(process.cwd(), ".build/production/server.7z");
export const SERVER_PATH = Path.resolve(process.cwd(), ".build/production/server");
export const ORIGINAL_DIST_PATH = Path.resolve(process.cwd(), "dist");
export const LEGACY_PACK_CONFIG_PATH = Path.resolve(process.cwd(), "pack.config.json");
export const LEGACY_PACK_CONFIG_TS_PATH = Path.resolve(process.cwd(), "pack.config.ts");
export const LEGACY_PACK_CONFIG_JS_PATH = Path.resolve(process.cwd(), "pack.config.js");
export const LEGACY_PACK_CONFIG_CJS_PATH = Path.resolve(process.cwd(), "pack.config.cjs");
export const LEGACY_PACK_CONFIG_MJS_PATH = Path.resolve(process.cwd(), "pack.config.mjs");

export const BUILD_EXECUTABLE = os.platform() === "win32" ? "production.exe" : "production";
export const SERVER_EXECUTABLE =
  os.platform() === "win32" ? "server-production.exe" : "server-production";

export const PACKAGE_JSON_CONTENT = {
  private: true,
  scripts: {
    start: `./${SERVER_EXECUTABLE}`,
  },
};

const DEFAULT_FILES_TO_COPY = {
  "vue/.output": "vue/.output",
  [`.build/.server/${BUILD_EXECUTABLE}`]: SERVER_EXECUTABLE,
};

export const FILES_TO_COPY = Object.fromEntries(
  Object.entries(DEFAULT_FILES_TO_COPY).map(([src, dest]) => [src, builtPath(dest)]),
);

type PackConfigIssueLevel = "warn" | "error";

type PackConfigIssue = {
  level: PackConfigIssueLevel;
  message: string;
};

function warnPackConfig(message: string) {
  printCommandWarn(`[pack] ${message}`);
}

function errorPackConfig(message: string): never {
  throw new Error(`[nuxt-gin-tools][pack] ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStringArray(
  fieldName: string,
  value: unknown,
  issues: PackConfigIssue[],
) {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    issues.push({ level: "error", message: `${fieldName} must be an array of strings` });
    return;
  }
  for (const item of value) {
    if (typeof item !== "string") {
      issues.push({ level: "error", message: `${fieldName} must contain only strings` });
      return;
    }
  }
}

function validateStringRecord(
  fieldName: string,
  value: unknown,
  issues: PackConfigIssue[],
) {
  if (value === undefined) {
    return;
  }
  if (!isPlainObject(value)) {
    issues.push({ level: "error", message: `${fieldName} must be an object of string to string` });
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof key !== "string" || typeof item !== "string") {
      issues.push({ level: "error", message: `${fieldName} must be an object of string to string` });
      return;
    }
  }
}

function validatePackConfig(config: unknown, sourcePath: string): PackConfig {
  if (!isPlainObject(config)) {
    errorPackConfig(`${Path.basename(sourcePath)} must export an object`);
  }

  const issues: PackConfigIssue[] = [];
  const typedConfig = config as Record<string, unknown>;

  const stringFields = ["binaryName", "zipName", "zipPath", "serverPath"];
  for (const field of stringFields) {
    const value = typedConfig[field];
    if (value !== undefined && typeof value !== "string") {
      issues.push({ level: "error", message: `${field} must be a string` });
    }
  }

  const booleanFields = [
    "skipGo",
    "skipNuxt",
    "skipBuild",
    "skipZip",
    "cleanDist",
    "writeScripts",
    "overwrite",
  ];
  for (const field of booleanFields) {
    const value = typedConfig[field];
    if (value !== undefined && typeof value !== "boolean") {
      issues.push({ level: "error", message: `${field} must be a boolean` });
    }
  }

  validateStringArray("extraFilesGlobs", typedConfig.extraFilesGlobs, issues);
  validateStringArray("exclude", typedConfig.exclude, issues);
  validateStringRecord("extraFiles", typedConfig.extraFiles, issues);

  if (typedConfig.packageJson !== undefined && !isPlainObject(typedConfig.packageJson)) {
    issues.push({ level: "error", message: `packageJson must be an object` });
  }
  if (typedConfig.beforePack !== undefined && typeof typedConfig.beforePack !== "function") {
    issues.push({ level: "error", message: `beforePack must be a function` });
  }
  if (typedConfig.afterPack !== undefined && typeof typedConfig.afterPack !== "function") {
    issues.push({ level: "error", message: `afterPack must be a function` });
  }
  if (typedConfig.zipName !== undefined && typedConfig.zipPath !== undefined) {
    issues.push({ level: "warn", message: `zipPath and zipName are both set; zipPath takes precedence` });
  }
  if (typedConfig.skipGo === true && typedConfig.skipNuxt === true) {
    issues.push({ level: "warn", message: `skipGo and skipNuxt are both true; build step will be skipped` });
  }
  if (typedConfig.skipBuild === true && typedConfig.skipZip === true) {
    issues.push({ level: "warn", message: `skipBuild and skipZip are both true; only bundle assembly will run` });
  }

  for (const issue of issues) {
    if (issue.level === "warn") {
      warnPackConfig(`${Path.basename(sourcePath)}: ${issue.message}`);
    }
  }
  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    errorPackConfig(`${Path.basename(sourcePath)} is invalid:\n- ${errors.map((item) => item.message).join("\n- ")}`);
  }

  return config as PackConfig;
}

function writeScriptFiles(serverPath: string, config?: PackConfig) {
  FS.outputFileSync(Path.resolve(serverPath, "start.bat"), `powershell -ExecutionPolicy ByPass -File ./start.ps1`);
  FS.outputFileSync(Path.resolve(serverPath, "start.ps1"), `./${SERVER_EXECUTABLE}`);
  FS.outputFileSync(Path.resolve(serverPath, "start.sh"), `./${SERVER_EXECUTABLE}`);
  const mergedPackageJson = mergePackageJson(PACKAGE_JSON_CONTENT, config?.packageJson);
  FS.outputJSONSync(Path.resolve(serverPath, "package.json"), mergedPackageJson, { spaces: 2 });
}

function writeServerConfigFile(serverPath: string) {
  const resolvedDest = Path.resolve(serverPath, "server.config.json");
  const projectServerConfigPath = Path.resolve(process.cwd(), "server.config.json");
  if (FS.existsSync(projectServerConfigPath)) {
    FS.copySync(projectServerConfigPath, resolvedDest);
    return;
  }
  throw new Error("server.config.json is required for packaging output");
}

function copyGeneratedFiles(serverPath: string, config?: PackConfig) {
  const copyOptions = {
    overwrite: config?.overwrite !== false,
    errorOnExist: config?.overwrite === false,
  };
  for (const [src, dest] of Object.entries(DEFAULT_FILES_TO_COPY)) {
    const resolvedDest = Path.resolve(serverPath, dest);
    FS.copySync(Path.resolve(process.cwd(), src), resolvedDest, copyOptions);
  }

  if (config?.extraFiles) {
    for (const [src, dest] of Object.entries(config.extraFiles)) {
      const resolvedSrc = Path.resolve(process.cwd(), src);
      const resolvedDest = Path.isAbsolute(dest) ? dest : Path.resolve(serverPath, dest);
      FS.copySync(resolvedSrc, resolvedDest, copyOptions);
    }
  }

  if (config?.extraFilesGlobs?.length) {
    const matchedFiles = fg.sync(config.extraFilesGlobs, {
      cwd: process.cwd(),
      onlyFiles: true,
      dot: true,
      ignore: config.exclude,
    });

    for (const file of matchedFiles) {
      const resolvedSrc = Path.resolve(process.cwd(), file);
      const resolvedDest = Path.resolve(serverPath, file);
      FS.copySync(resolvedSrc, resolvedDest, copyOptions);
    }
  }

  writeServerConfigFile(serverPath);
}

function mergePackageJson(
  base: Record<string, unknown>,
  override?: Record<string, unknown>,
): Record<string, unknown> {
  if (!override) {
    return base;
  }

  const baseScripts = typeof base.scripts === "object" && base.scripts ? base.scripts : {};
  const overrideScripts =
    typeof override.scripts === "object" && override.scripts ? override.scripts : {};

  return {
    ...base,
    ...override,
    scripts: {
      ...baseScripts,
      ...overrideScripts,
    },
  };
}

function readPackConfigFromCwd(): PackConfig | undefined {
  const candidates = [
    LEGACY_PACK_CONFIG_TS_PATH,
    LEGACY_PACK_CONFIG_JS_PATH,
    LEGACY_PACK_CONFIG_CJS_PATH,
    LEGACY_PACK_CONFIG_MJS_PATH,
    LEGACY_PACK_CONFIG_PATH,
  ].filter((configPath) => FS.existsSync(configPath));

  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length > 1) {
    warnPackConfig(
      `multiple legacy pack config files found (${candidates.map((item) => Path.basename(item)).join(", ")}); using ${Path.basename(candidates[0])}`,
    );
  }

  const selectedPath = candidates[0];
  let loadedConfig: unknown;
  if (selectedPath.endsWith(".json")) {
    loadedConfig = FS.readJSONSync(selectedPath);
  } else {
    const jiti = createJiti(__filename, { moduleCache: false, interopDefault: true });
    loadedConfig = jiti(selectedPath);
  }

  const normalizedConfig =
    isPlainObject(loadedConfig) && "default" in loadedConfig
      ? (loadedConfig as { default: unknown }).default
      : loadedConfig;

  return validatePackConfig(normalizedConfig, selectedPath);
}

function resolveServerPath(config?: PackConfig): string {
  if (!config?.serverPath) {
    return SERVER_PATH;
  }
  return Path.isAbsolute(config.serverPath)
    ? config.serverPath
    : Path.resolve(process.cwd(), config.serverPath);
}

function resolveZipPath(config?: PackConfig): string {
  if (config?.zipPath) {
    return Path.isAbsolute(config.zipPath)
      ? config.zipPath
      : Path.resolve(process.cwd(), config.zipPath);
  }

  if (config?.zipName) {
    return Path.resolve(Path.dirname(ZIP_PATH), config.zipName);
  }

  return ZIP_PATH;
}

function makeZip(serverPath: string, zipPath: string) {
  return new Promise((resolve, reject) => {
    Zip.pack(serverPath, zipPath, (error) => {
      if (error) {
        printCommandError("打包失败", error);
        reject(error);
        return;
      }

      printCommandSuccess("pack", `archive ready: ${zipPath}`);
      resolve(zipPath);
    });
  });
}

function cleanUp(config?: PackConfig) {
  if (config?.cleanDist === false) {
    return;
  }
  if (FS.existsSync(ORIGINAL_DIST_PATH)) {
    FS.removeSync(ORIGINAL_DIST_PATH);
  }
}

export async function buildAndPack(config?: PackConfig) {
  printCommandBanner("build", "Build project artifacts and pack deployment bundle");
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const actions: string[] = [];
  const legacyPackConfig = readPackConfigFromCwd();
  if (!projectConfig.config.pack && legacyPackConfig) {
    printCommandWarn("[config] using legacy pack.config.* fallback; migrate to nuxt-gin.config.ts");
  }
  const resolvedConfig = mergeDefined<PackConfig>(
    projectConfig.config.pack ?? legacyPackConfig,
    config,
  );
  if (!readLegacyServerConfig()) {
    throw new Error("server.config.json is required in project root before running build");
  }
  const serverPath = resolveServerPath(resolvedConfig);
  const zipPath = resolveZipPath(resolvedConfig);
  if (!resolvedConfig?.skipBuild) {
    await build(resolvedConfig);
    actions.push("built project artifacts");
  } else {
    printCommandInfo("build", "skipping build step");
    actions.push("skipped build step");
  }
  if (resolvedConfig?.beforePack) {
    await resolvedConfig.beforePack();
    actions.push("ran beforePack hook");
  }
  copyGeneratedFiles(serverPath, resolvedConfig);
  actions.push(`assembled bundle in ${serverPath}`);
  if (resolvedConfig?.writeScripts !== false) {
    writeScriptFiles(serverPath, resolvedConfig);
    actions.push("wrote startup scripts and package.json");
  } else {
    actions.push("skipped startup script generation");
  }
  if (!resolvedConfig?.skipZip) {
    await makeZip(serverPath, zipPath);
    printCommandInfo("pack", `7z archive: ${zipPath}`);
    actions.push(`created 7z archive at ${zipPath}`);
  } else {
    printCommandInfo("pack", "skipping 7z archive step");
    actions.push("skipped 7z archive step");
  }
  printCommandInfo("pack", `bundle dir: ${serverPath}`);
  if (resolvedConfig?.afterPack) {
    await resolvedConfig.afterPack(zipPath);
    actions.push("ran afterPack hook");
  }
  cleanUp(resolvedConfig);
  if (resolvedConfig?.cleanDist === false) {
    actions.push("kept dist directory by configuration");
  } else {
    actions.push("cleaned dist directory");
  }
  printCommandSuccess("build", "Build and pack completed");
  printCommandSummary("build", actions);
}

export default buildAndPack;
