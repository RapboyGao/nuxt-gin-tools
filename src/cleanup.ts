import * as FS from "fs-extra";
import * as Path from "path";
import concurrently from "concurrently";
import chalk from "chalk";

const cwd = process.cwd();

export function ifExistsRemove(relativePath: string) {
  const absolutePath = Path.resolve(cwd, relativePath);
  if (FS.existsSync(absolutePath)) {
    FS.removeSync(absolutePath);
  }
}

export function cleanUpNuxt() {
  return concurrently([
    {
      command: "npx nuxt cleanup",
    },
  ]).result;
}

export function cleanUpBuild() {
  // 清理构建目录
  ifExistsRemove(".build/production");
  // 清理原始 dist 目录
  ifExistsRemove("dist");
  // 清理临时文件
  ifExistsRemove(".build");
  // 清理临时文件
  ifExistsRemove("tmp");
  // 清理 Vue 应用构建输出目录
  ifExistsRemove("vue/.output");
  // 清理 OpenAPI 生成的文件
  ifExistsRemove(".openapi-generator");
  // 清理go.sum
  // ifExistsRemove("go.sum");
}

/**
 * 清理构建目录和临时文件
 */
export async function cleanUp() {
  const result = cleanUpNuxt();
  cleanUpBuild();
  await result;
  console.log(chalk.bgGreen("----- 清理完成！-----"));
}

export default cleanUp;
