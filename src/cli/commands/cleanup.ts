import * as FS from "fs-extra";
import * as Path from "path";
import concurrently from "concurrently";
import { mergeDefined, resolveNuxtGinProjectConfig } from "../../nuxt-gin";
import { selectWithDefault } from "../prompt";
import {
  printCommandBanner,
  printCommandInfo,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../terminal-ui";

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
  skipNuxtCleanup?: boolean;
  cleanupPaths?: string[];
};

type CleanupMode = "full" | "nuxt-only" | "build-only";

function hasExplicitCleanupOptions(options?: CleanupOptions): boolean {
  return Boolean(options?.cleanupPaths !== undefined || options?.skipNuxtCleanup !== undefined);
}

async function resolveCleanupOptions(
  options: CleanupOptions = {},
  configuredOptions: CleanupOptions = {},
): Promise<CleanupOptions> {
  if (hasExplicitCleanupOptions(options)) {
    return options;
  }
  if (
    configuredOptions.cleanupPaths !== undefined ||
    configuredOptions.skipNuxtCleanup !== undefined
  ) {
    return options;
  }

  const mode = await selectWithDefault<CleanupMode>({
    label: "cleanup",
    message: "Choose cleanup workflow",
    defaultValue: "full",
    nonInteractiveMessage: "Non-interactive terminal detected, using default cleanup workflow: full",
    options: [
      {
        label: "Full cleanup",
        value: "full",
        hint: "Run nuxt cleanup and remove generated build output",
      },
      {
        label: "Nuxt only",
        value: "nuxt-only",
        hint: "Only run nuxt cleanup",
      },
      {
        label: "Build output only",
        value: "build-only",
        hint: "Only remove generated directories without running nuxt cleanup",
      },
    ],
  });

  if (mode === "nuxt-only") {
    return {
      skipNuxtCleanup: false,
      cleanupPaths: [],
    };
  }

  if (mode === "build-only") {
    return {
      skipNuxtCleanup: true,
      cleanupPaths: [...CLEANUP_PATHS],
    };
  }

  return {
    skipNuxtCleanup: false,
    cleanupPaths: [...CLEANUP_PATHS],
  };
}

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
  if (options.skipNuxtCleanup) {
    actions.push("skipped nuxt cleanup");
    return Promise.resolve();
  }
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
  const cleanupTargets = options.cleanupPaths ?? [...CLEANUP_PATHS];
  for (const path of cleanupTargets) {
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
  const configuredOptions = projectConfig.config.cleanup ?? {};
  const promptedOptions = await resolveCleanupOptions(options, configuredOptions);
  const resolvedOptions = mergeDefined<CleanupOptions>(
    configuredOptions,
    promptedOptions,
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
