#!/usr/bin/env node
// index.ts - 入口文件，用于处理命令行参数并调用相应的功能模块
// 导入构建和打包功能
import buildAndPack from "./src/cli/commands/build";
// 导入开发模式功能
import develop, { developGo, developNuxt } from "./src/cli/commands/develop";
// 导入安装后处理功能
import postInstall from "./src/cli/commands/install";
// 导入清理功能
import cleanUp from "./src/cli/commands/cleanup";
// 导入更新功能
import update from "./src/cli/commands/update";
import {
  getOption,
  getOptionalBooleanOption,
  hasFlag,
  parseCLIOptions,
} from "./src/cli/options";
import {
  isPackageManagerSelection,
  type PackageManagerSelection,
} from "./src/config/package-manager";
import { printCommandError } from "./src/cli/terminal-ui";

// 获取命令行参数（去除前两个默认参数）
const args = process.argv.slice(2);

// 检查是否提供了命令
if (args.length === 0) {
  printCommandError("未提供命令。请指定要运行的命令。");
  process.exit(1);
}

async function main() {
  const command = args[0];
  const options = parseCLIOptions(args.slice(1));
  const rawPackageManager = getOption(options, "package-manager");
  const packageManagerCandidate = rawPackageManager ?? "auto";
  if (!isPackageManagerSelection(packageManagerCandidate)) {
    throw new Error(
      `Invalid value for --package-manager: ${packageManagerCandidate}. Expected one of: auto, bun, pnpm, yarn, npm, cnpm`,
    );
  }
  const packageManagerOption: PackageManagerSelection = packageManagerCandidate;

  switch (command) {
    case "dev":
      await develop({
        noCleanup: hasFlag(options, "no-cleanup"),
        skipGo: hasFlag(options, "skip-go"),
        skipNuxt: hasFlag(options, "skip-nuxt"),
      });
      break;
    case "dev:nuxt":
      await developNuxt({
        noCleanup: hasFlag(options, "no-cleanup"),
      });
      break;
    case "dev:go":
      await developGo({
        noCleanup: hasFlag(options, "no-cleanup"),
      });
      break;
    case "build":
      await buildAndPack({
        binaryName: getOption(options, "binary-name"),
        skipGo: hasFlag(options, "skip-go"),
        skipNuxt: hasFlag(options, "skip-nuxt"),
        skipBuild: hasFlag(options, "skip-build"),
        skipZip: hasFlag(options, "skip-zip"),
      });
      break;
    case "install":
      // 执行安装后的初始化操作
      await postInstall({
        skipGo: hasFlag(options, "skip-go"),
        skipNuxt: hasFlag(options, "skip-nuxt"),
      });
      break;
    case "cleanup":
      // 执行清理操作
      await cleanUp({
        dryRun: hasFlag(options, "dry-run"),
      });
      break;
    case "update":
      // 更新依赖
      await update({
        latest: getOptionalBooleanOption(options, "latest"),
        packageManager: packageManagerOption,
        skipGo: hasFlag(options, "skip-go"),
        skipNode: hasFlag(options, "skip-node"),
      });
      break;
    default:
      printCommandError(`未知命令: ${command}`);
      process.exit(1);
  }
}

void main().catch((error) => {
  printCommandError("命令执行失败", error);
  process.exit(1);
});
