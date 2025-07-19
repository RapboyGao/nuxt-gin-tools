/**
 * 警告：本文件是API生成框架的一部分，请勿手动修改！
 * 任何修改可能会被自动化流程覆盖。
 * 如需调整生成逻辑，请修改相关配置文件或脚本。
 */

import chalk from "chalk";
import type { ConcurrentlyCommandInput } from "concurrently"; // 引入类型定义以支持TypeScript
import concurrently from "concurrently"; // 用于并发执行命令的工具
import Fs from "fs-extra"; // 文件系统操作工具，提供更便捷的API
import Path from "path"; // 处理和转换文件路径的工具

const cwd = process.cwd(); // 获取当前工作目录

/**
 * 要执行的命令列表
 * 包含OpenAPI代码生成命令：
 * 1. 生成Go Gin服务器代码
 * 2. 生成TypeScript Axios客户端代码
 */
let commands: ConcurrentlyCommandInput[] = [
  {
    command: "openapi-generator-cli generate -i openapi.yaml -g go-gin-server -c node_modules/nuxt3-gin-tools/src/go-gin-server.json -o .",
    name: "go",
    prefixColor: "green",
  },
  {
    command: "openapi-generator-cli generate -i openapi.yaml -g typescript-axios -o vue/composables/api ",
    name: "vue",
    prefixColor: "blue",
  },
];

/**
 * 执行完成后需要删除的路径列表
 */
const pathsToDelete = ["api"];

/**
 * 设置Vue API客户端的基础URL
 * 修改TypeScript axios生成的base.ts文件，将BASE_PATH设置为相对路径
 * @returns {Promise<string>} 返回原始文件内容的Promise
 */
async function setVueBaseUrl() {
  try {
    // 构建Vue API运行时配置文件的完整路径
    const VUE_API_RUNTIME_PATH = Path.join(cwd, "vue/composables/api/base.ts");

    // 读取原始文件内容
    const originalContent = await Fs.readFile(VUE_API_RUNTIME_PATH, "utf-8");

    // 使用正则表达式替换BASE_PATH常量，移除协议和域名部分，使其成为相对路径
    // 匹配类似 "export const BASE_PATH = "https://example.com"" 这样的行
    const updatedContent = originalContent.replace(/export\s+const\s+BASE_PATH = "https?:\/\/[^/]+/, `export const BASE_PATH = "`);

    // 将修改后的内容写回文件
    await Fs.outputFile(VUE_API_RUNTIME_PATH, updatedContent, "utf-8");

    console.log("成功更新Vue API基础URL为相对路径");
    return originalContent;
  } catch (error) {
    console.error("更新Vue API基础URL失败:", error);
    throw error; // 将错误继续抛出，以便上层处理
  }
}

/**
 * 删除指定的路径
 * 用于清理生成过程中产生的临时或不需要的文件和目录
 */
async function removePaths() {
  try {
    // 遍历要删除的路径列表
    for (const path of pathsToDelete) {
      // 构建完整路径
      const fullPath = Path.join(cwd, path);

      // 删除路径（文件或目录）
      await Fs.remove(fullPath);

      console.log(`成功删除路径: ${fullPath}`);
    }
  } catch (error) {
    console.error("删除路径失败:", error);
    throw error; // 将错误继续抛出
  }
}

/**
 * 主函数
 * 协调执行所有任务：生成代码、删除路径、配置Vue API
 */
export async function apiGenerate() {
  try {
    // 输出开始信息
    console.log(chalk.bgGreen("开始生成API代码..."));

    // 并发执行命令列表中的所有命令，等待所有命令完成
    await concurrently(commands).result;

    // 按顺序执行清理和配置任务
    await removePaths();
    await setVueBaseUrl();

    console.log(chalk.bgGreen("API代码生成和配置完成!"));
  } catch (error) {
    // 捕获并处理任何阶段发生的错误
    console.error(chalk.red("执行过程中发生错误:"), error);
    // 以错误码1退出进程，表示执行失败
    process.exit(1);
  }
}

// 执行主函数
export default apiGenerate;
