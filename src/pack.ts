// 导入项目构建工具，用于执行 Nuxt 项目的构建流程
import build from "./builder";
// 导入 7zip 压缩工具库，用于将构建后的文件打包为 7z 格式
import * as Zip from "7zip-min";
// 导入增强版的文件系统模块，提供更丰富的文件操作 API
import * as FS from "fs-extra";
// 导入路径处理模块，用于规范化和解析文件路径
import * as Path from "path";

/**
 * 生成相对于服务器构建目录的绝对路径
 * @param relativePath - 相对路径
 * @returns 解析后的绝对路径
 */
export function builtPath(relativePath: string): string {
  return Path.resolve(SERVER_PATH, relativePath);
}

// 定义打包后的 7z 文件输出路径
export const ZIP_PATH = Path.resolve(process.cwd(), ".build/server.7z");
// 定义服务器构建文件的输出目录
export const SERVER_PATH = Path.resolve(process.cwd(), ".build/server");
// 定义原始 dist 目录路径，用于清理操作
export const ORIGINAL_DIST_PATH = Path.resolve(process.cwd(), "dist");

// 定义打包后项目的 package.json 内容
export const PACKAGE_JSON_CONTENT = {
  private: true,
  scripts: {
    start: "./.server/production.exe", // 定义启动命令
  },
};

// 定义需要复制到构建目录的文件映射关系
export const FILES_TO_COPY = {
  "vue/.output": builtPath("vue/.output"), // Vue 应用构建输出
  ".server/production.exe": builtPath(".server/production.exe"), // 生产环境可执行文件
  "server.config.json": builtPath("server.config.json"), // 服务器配置文件
};

/**
 * 写入启动脚本和 package.json 文件到构建目录
 */
function writeScriptFiles() {
  // 写入 Windows 批处理启动脚本
  FS.outputFileSync(builtPath("start.bat"), `powershell -ExecutionPolicy ByPass -File ./start.ps1`);
  // 写入 PowerShell 启动脚本
  FS.outputFileSync(builtPath("start.ps1"), `./.server/production.exe`);
  // 写入 Linux/macOS 启动脚本
  FS.outputFileSync(builtPath("start.sh"), `./.server/production.exe`);
  // 写入 package.json 文件，使用 2 个空格缩进
  FS.outputJSONSync(builtPath("package.json"), PACKAGE_JSON_CONTENT, { spaces: 2 });
}

/**
 * 将配置的源文件复制到构建目录
 */
function copyGeneratedFiles() {
  // 遍历文件映射，将每个源文件复制到目标位置
  for (const [src, dest] of Object.entries(FILES_TO_COPY)) {
    FS.copySync(Path.resolve(process.cwd(), src), dest);
  }
}

/**
 * 打包文件为7z格式
 */
function makeZip() {
  return new Promise((resolve, reject) => {
    // 使用 7zip 将服务器构建目录打包为 7z 文件
    Zip.pack(SERVER_PATH, ZIP_PATH, (error) => {
      if (error) {
        console.error("打包失败:", error);
        reject(error);
      }

      console.log("打包成功:", ZIP_PATH);
      resolve(ZIP_PATH);
    });
  });
}

/**
 * 清理原始 dist 目录
 */
function cleanUp() {
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
export async function buildAndPack() {
  await build(); // 执行项目构建
  copyGeneratedFiles(); // 复制相关文件
  writeScriptFiles(); // 写入脚本文件
  await makeZip(); // 打包文件
  cleanUp(); // 清理临时文件
}

export default buildAndPack;
