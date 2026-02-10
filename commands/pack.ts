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

export interface PackConfig {
  /**
   * 额外需要打包的文件映射
   * key: 源文件路径（相对于项目根目录或绝对路径）
   * value: 打包后对应位置（相对于服务器构建目录或绝对路径）
   */
  extraFiles?: Record<string, string>;
  /**
   * 额外需要打包的文件 Glob（相对于项目根目录）
   */
  extraFilesGlobs?: string[];
  /**
   * 排除文件/目录 Glob（相对于项目根目录）
   */
  exclude?: string[];
  /**
   * 打包输出 zip 名称（相对于默认 zip 目录）
   */
  zipName?: string;
  /**
   * 打包输出 zip 路径（相对于项目根目录或绝对路径）
   */
  zipPath?: string;
  /**
   * 服务器构建输出目录（相对于项目根目录或绝对路径）
   */
  serverPath?: string;
  /**
   * 打包前钩子
   */
  beforePack?: () => Promise<void> | void;
  /**
   * 打包后钩子
   */
  afterPack?: (zipPath: string) => Promise<void> | void;
  /**
   * 是否清理 dist
   */
  cleanDist?: boolean;
  /**
   * 是否写入启动脚本和 package.json
   */
  writeScripts?: boolean;
  /**
   * 写入/覆盖 package.json 内容
   */
  packageJson?: Record<string, unknown>;
  /**
   * 复制时是否覆盖同名文件
   */
  overwrite?: boolean;
}

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

export const SERVER_EXECUTABLE = os.platform() === "win32" ? "server-production.exe" : "server-production"; // 根据操作系统选择可执行文件名

// 定义打包后项目的 package.json 内容
export const PACKAGE_JSON_CONTENT = {
  private: true,
  scripts: {
    start: "./server-production.exe", // 定义启动命令
  },
};

// 定义需要复制到构建目录的文件映射关系（目标为构建目录下的相对路径）
const DEFAULT_FILES_TO_COPY = {
  "vue/.output": "vue/.output", // Vue 应用构建输出
  [`.build/.server/production.exe`]: "server-production.exe", // 生产环境可执行文件
  "server.config.json": "server.config.json", // 服务器配置文件
};

// 兼容旧导出：默认构建目录下的绝对目标路径
export const FILES_TO_COPY = Object.fromEntries(
  Object.entries(DEFAULT_FILES_TO_COPY).map(([src, dest]) => [src, builtPath(dest)]),
);

/**
 * 写入启动脚本和 package.json 文件到构建目录
 */
function writeScriptFiles(serverPath: string, config?: PackConfig) {
  // 写入 Windows 批处理启动脚本
  FS.outputFileSync(Path.resolve(serverPath, "start.bat"), `powershell -ExecutionPolicy ByPass -File ./start.ps1`);
  // 写入 PowerShell 启动脚本
  FS.outputFileSync(Path.resolve(serverPath, "start.ps1"), `./server-production.exe`);
  // 写入 Linux/macOS 启动脚本
  FS.outputFileSync(Path.resolve(serverPath, "start.sh"), `./server-production.exe`);
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
  if (!FS.existsSync(PACK_CONFIG_PATH)) {
    return undefined;
  }

  return FS.readJSONSync(PACK_CONFIG_PATH) as PackConfig;
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
  const resolvedConfig = config ?? readPackConfigFromCwd();
  const serverPath = resolveServerPath(resolvedConfig);
  const zipPath = resolveZipPath(resolvedConfig);
  await build(); // 执行项目构建
  if (resolvedConfig?.beforePack) {
    await resolvedConfig.beforePack();
  }
  copyGeneratedFiles(serverPath, resolvedConfig); // 复制相关文件
  if (resolvedConfig?.writeScripts !== false) {
    writeScriptFiles(serverPath, resolvedConfig); // 写入脚本文件
  }
  await makeZip(serverPath, zipPath); // 打包文件
  if (resolvedConfig?.afterPack) {
    await resolvedConfig.afterPack(zipPath);
  }
  cleanUp(resolvedConfig); // 清理临时文件
}

export default buildAndPack;
