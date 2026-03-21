import * as FS from "fs-extra";
import * as Path from "path";
import concurrently from "concurrently";
import { mergeDefined, resolveNuxtGinProjectConfig } from "../src/nuxt-gin";
import {
  printCommandBanner,
  printCommandInfo,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../src/terminal-ui";

const cwd = process.cwd();
const CLEANUP_PATHS = [
  ".build/production",
  "dist",
  ".build",
  "tmp",
  "vue/.output",
  ".openapi-generator",
] as const;

export type CleanupOptions = {
  dryRun?: boolean;
};

export function ifExistsRemove(
  relativePath: string,
  options: CleanupOptions = {},
  actions: string[] = [],
) {
  const absolutePath = Path.resolve(cwd, relativePath);
  if (FS.existsSync(absolutePath)) {
    if (options.dryRun) {
      printCommandInfo("cleanup", `would remove ${absolutePath}`);
      actions.push(`would remove ${relativePath}`);
      return;
    }
    FS.removeSync(absolutePath);
    actions.push(`removed ${relativePath}`);
  }
}

export function cleanUpNuxt(options: CleanupOptions = {}, actions: string[] = []) {
  if (options.dryRun) {
    printCommandInfo("cleanup", "would run `npx nuxt cleanup`");
    actions.push("would run nuxt cleanup");
    return Promise.resolve();
  }
  actions.push("ran nuxt cleanup");
  return concurrently([
    {
      command: "npx nuxt cleanup",
    },
  ]).result;
}

export function cleanUpBuild(options: CleanupOptions = {}, actions: string[] = []) {
  for (const path of CLEANUP_PATHS) {
    ifExistsRemove(path, options, actions);
  }
}

/**
 * 清理构建目录和临时文件
 */
export async function cleanUp(options: CleanupOptions = {}) {
  printCommandBanner("cleanup", "Remove generated build output and temporary files");
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const resolvedOptions = mergeDefined<CleanupOptions>(
    projectConfig.config.cleanup,
    options,
  );
  const actions: string[] = [];
  const result = cleanUpNuxt(resolvedOptions, actions);
  cleanUpBuild(resolvedOptions, actions);
  await result;
  printCommandSuccess(
    "cleanup",
    resolvedOptions.dryRun ? "Dry run completed" : "Temporary files removed",
  );
  printCommandSummary("cleanup", actions);
}

export default cleanUp;
