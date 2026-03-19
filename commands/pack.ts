// 导入项目构建工具，用于执行 Nuxt 项目的构建流程
import build from "./builder";
// 导入 7zip 压缩工具库，用于将构建后的文件打包为 7z 格式
import * as Zip from "7zip-min";
// 导入增强版的文件系统模块，提供更丰富的文件操作 API
import * as FS from "fs-extra";
// 导入路径处理模块，用于规范化和解析文件路径
import * as Path from "path";

import * as os from "os";
import fg from "fast-glob";
import type { PackConfig } from "../src/pack";
import {
  printCommandBanner,
  printCommandInfo,
  printCommandSuccess,
  printCommandWarn,
} from "../src/terminal-ui";

const { createJiti } = require("jiti");

/**
 * 生成相对于服务器构建目录的绝对路径
 * @param relativePath - 相对路径
 * @returns 解析后的绝对路径
 */
export function builtPath(relativePath: string): string {
  return Path.resolve(SERVER_PATH, relativePath);
}

// 定义打包后的 7z 文件输出路径
export const ZIP_PATH = Path.resolve(process.cwd(), ".build/production/server.7z");
// 定义服务器构建文件的输出目录
export const SERVER_PATH = Path.resolve(process.cwd(), ".build/production/server");
// 定义原始 dist 目录路径，用于清理操作
export const ORIGINAL_DIST_PATH = Path.resolve(process.cwd(), "dist");
export const PACK_CONFIG_PATH = Path.resolve(process.cwd(), "pack.config.json");
export const PACK_CONFIG_TS_PATH = Path.resolve(process.cwd(), "pack.config.ts");
export const PACK_CONFIG_JS_PATH = Path.resolve(process.cwd(), "pack.config.js");
export const PACK_CONFIG_CJS_PATH = Path.resolve(process.cwd(), "pack.config.cjs");
export const PACK_CONFIG_MJS_PATH = Path.resolve(process.cwd(), "pack.config.mjs");

export const BUILD_EXECUTABLE = os.platform() === "win32" ? "production.exe" : "production";
export const SERVER_EXECUTABLE =
  os.platform() === "win32" ? "server-production.exe" : "server-production"; // 根据操作系统选择可执行文件名

// 定义打包后项目的 package.json 内容
export const PACKAGE_JSON_CONTENT = {
  private: true,
  scripts: {
    start: `./${SERVER_EXECUTABLE}`, // 定义启动命令
  },
};

// 定义需要复制到构建目录的文件映射关系（目标为构建目录下的相对路径）
const DEFAULT_FILES_TO_COPY = {
  "vue/.output": "vue/.output", // Vue 应用构建输出
  [`.build/.server/${BUILD_EXECUTABLE}`]: SERVER_EXECUTABLE, // 生产环境可执行文件
  "server.config.json": "server.config.json", // 服务器配置文件
};

// 兼容旧导出：默认构建目录下的绝对目标路径
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

  const booleanFields = ["skipGo", "skipNuxt", "cleanDist", "writeScripts", "overwrite"];
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

/**
 * 写入启动脚本和 package.json 文件到构建目录
 */
function writeScriptFiles(serverPath: string, config?: PackConfig) {
  // 写入 Windows 批处理启动脚本
  FS.outputFileSync(Path.resolve(serverPath, "start.bat"), `powershell -ExecutionPolicy ByPass -File ./start.ps1`);
  // 写入 PowerShell 启动脚本
  FS.outputFileSync(Path.resolve(serverPath, "start.ps1"), `./${SERVER_EXECUTABLE}`);
  // 写入 Linux/macOS 启动脚本
  FS.outputFileSync(Path.resolve(serverPath, "start.sh"), `./${SERVER_EXECUTABLE}`);
  // 写入 package.json 文件，使用 2 个空格缩进
  const mergedPackageJson = mergePackageJson(PACKAGE_JSON_CONTENT, config?.packageJson);
  FS.outputJSONSync(Path.resolve(serverPath, "package.json"), mergedPackageJson, { spaces: 2 });
}

/**
 * 将配置的源文件复制到构建目录
 */
function copyGeneratedFiles(serverPath: string, config?: PackConfig) {
  const copyOptions = {
    overwrite: config?.overwrite !== false,
    errorOnExist: config?.overwrite === false,
  };
  // 遍历文件映射，将每个源文件复制到目标位置
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
    PACK_CONFIG_TS_PATH,
    PACK_CONFIG_JS_PATH,
    PACK_CONFIG_CJS_PATH,
    PACK_CONFIG_MJS_PATH,
    PACK_CONFIG_PATH,
  ].filter((configPath) => FS.existsSync(configPath));

  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length > 1) {
    warnPackConfig(
      `multiple pack config files found (${candidates.map((item) => Path.basename(item)).join(", ")}); using ${Path.basename(candidates[0])}`,
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

/**
 * 打包文件为7z格式
 */
function makeZip(serverPath: string, zipPath: string) {
  return new Promise((resolve, reject) => {
    // 使用 7zip 将服务器构建目录打包为 7z 文件
    Zip.pack(serverPath, zipPath, (error) => {
      if (error) {
        console.error("打包失败:", error);
        reject(error);
      }

      console.log("打包成功:", zipPath);
      resolve(zipPath);
    });
  });
}

/**
 * 清理原始 dist 目录
 */
function cleanUp(config?: PackConfig) {
  if (config?.cleanDist === false) {
    return;
  }
  // 检查原始 dist 目录是否存在，存在则删除
  if (FS.existsSync(ORIGINAL_DIST_PATH)) {
    FS.removeSync(ORIGINAL_DIST_PATH);
  }
}

/**
 * 构建并打包项目的主函数
 * 1. 执行项目构建
 * 2. 复制生成的文件
 * 3. 写入启动脚本
 * 4. 打包文件为 7z 格式
 * 5. 清理原始 dist 目录
 */
export async function buildAndPack(config?: PackConfig) {
  printCommandBanner("build", "Build project artifacts and pack deployment bundle");
  const resolvedConfig = config ?? readPackConfigFromCwd();
  const serverPath = resolveServerPath(resolvedConfig);
  const zipPath = resolveZipPath(resolvedConfig);
  await build(resolvedConfig); // 执行项目构建
  if (resolvedConfig?.beforePack) {
    await resolvedConfig.beforePack();
  }
  copyGeneratedFiles(serverPath, resolvedConfig); // 复制相关文件
  if (resolvedConfig?.writeScripts !== false) {
    writeScriptFiles(serverPath, resolvedConfig); // 写入脚本文件
  }
  await makeZip(serverPath, zipPath); // 打包文件
  printCommandInfo("pack", `7z archive: ${zipPath}`);
  printCommandInfo("pack", `bundle dir: ${serverPath}`);
  if (resolvedConfig?.afterPack) {
    await resolvedConfig.afterPack(zipPath);
  }
  cleanUp(resolvedConfig); // 清理临时文件
  printCommandSuccess("build", "Build and pack completed");
}

export default buildAndPack;
