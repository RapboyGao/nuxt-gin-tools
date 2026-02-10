#!/usr/bin/env node
// index.ts - 入口文件，用于处理命令行参数并调用相应的功能模块
// 导入构建和打包功能
import buildAndPack from "./commands/pack";
// 导入开发模式功能
import develop, { developGo, developNuxt } from "./commands/develop";
// 导入API生成功能
import apiGenerate from "./commands/api-generate";
// 导入安装后处理功能
import postInstall from "./commands/postinstall";
// 导入清理功能
import cleanUp from "./commands/cleanup";
// 导入更新功能
import update from "./commands/update";

// 获取命令行参数（去除前两个默认参数）
const args = process.argv.slice(2);

// 检查是否提供了命令
if (args.length === 0) {
  console.error("未提供命令。请指定要运行的命令。");
  process.exit(1);
}

// 根据第一个参数执行对应的命令
switch (args[0]) {
  case "dev":
    // 启动开发模式
    develop();
    break;
  case "dev:nuxt":
    // 仅启动 Nuxt 开发模式
    developNuxt();
    break;
  case "dev:go":
    // 仅启动 Go 开发模式
    developGo();
    break;
  case "build":
    // 执行构建和打包操作
    buildAndPack();
    break;
  case "gen":
    // 生成API代码（注：此处命令可能拼写错误，应为generate）
    apiGenerate();
    break;
  case "install":
    // 执行安装后的初始化操作
    postInstall();
    break;
  case "cleanup":
    // 执行清理操作
    cleanUp();
    break;
  case "update":
    // 更新依赖
    update();
    break;
  default:
    console.error(`未知命令: ${args[0]}`);
    process.exit(1);
}
