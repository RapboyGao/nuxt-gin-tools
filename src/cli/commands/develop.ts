import concurrently from "concurrently";
import { ensureDirSync, existsSync } from "fs-extra";
import { join } from "path";
import cleanUp from "./cleanup";
import postInstall from "./install";
import { startGoDev } from "../../services/go-dev-service";
import {
  mergeDefined,
  readLegacyServerConfig,
  resolveNuxtGinProjectConfig,
} from "../../nuxt-gin";
import type { ServerConfigJson } from "../../nuxt-config";
import { killPorts } from "../../system/ports";
import { selectWithDefault } from "../prompt";
import {
  printCommandBanner,
  printCommandSummary,
  printCommandWarn,
} from "../terminal-ui";

const cwd = process.cwd();

export type DevelopOptions = {
  noCleanup?: boolean;
  skipGo?: boolean;
  skipNuxt?: boolean;
};

type DevelopMode = "full" | "nuxt-only" | "go-only";

type DevelopContext = {
  options: DevelopOptions;
  serverConfig: ServerConfigJson;
  cleanupBeforeDevelop: boolean;
  killPortBeforeDevelop: boolean;
};

function hasExplicitDevelopModeOptions(options?: DevelopOptions): boolean {
  return Boolean(options?.skipGo !== undefined || options?.skipNuxt !== undefined);
}

async function resolveDevelopOptions(
  options: DevelopOptions = {},
  configuredOptions: DevelopOptions = {},
): Promise<DevelopOptions> {
  if (hasExplicitDevelopModeOptions(options)) {
    return options;
  }
  if (configuredOptions.skipGo !== undefined || configuredOptions.skipNuxt !== undefined) {
    return options;
  }

  const mode = await selectWithDefault<DevelopMode>({
    label: "dev",
    message: "Choose development workflow",
    defaultValue: "full",
    nonInteractiveMessage: "Non-interactive terminal detected, using default development workflow: full",
    options: [
      {
        label: "Nuxt + Go",
        value: "full",
        hint: "Start both the Nuxt dev server and Go watcher",
      },
      {
        label: "Nuxt only",
        value: "nuxt-only",
        hint: "Only start the Nuxt dev server",
      },
      {
        label: "Go only",
        value: "go-only",
        hint: "Only start the Go watcher",
      },
    ],
  });

  return {
    skipGo: mode === "nuxt-only",
    skipNuxt: mode === "go-only",
  };
}

async function resolveDevelopContext(options: DevelopOptions = {}): Promise<DevelopContext> {
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const serverConfig = readLegacyServerConfig();
  if (!serverConfig) {
    throw new Error(
      "server.config.json is required in project root for ginPort, nuxtPort, and baseUrl.",
    );
  }

  const configuredOptions = projectConfig.config.dev ?? {};
  const promptedOptions = await resolveDevelopOptions(options, configuredOptions);
  const resolvedOptions = mergeDefined<DevelopOptions>(
    configuredOptions,
    promptedOptions,
  );
  const cleanupBeforeDevelop =
    projectConfig.config.dev?.cleanupBeforeDevelop ?? false;
  const killPortBeforeDevelop =
    projectConfig.config.dev?.killPortBeforeDevelop ?? true;

  return {
    options: resolvedOptions,
    serverConfig,
    cleanupBeforeDevelop,
    killPortBeforeDevelop,
  };
}

async function prepareDevelop(context: DevelopContext) {
  const shouldPrepare = !context.options.noCleanup;
  if (!shouldPrepare) {
    return;
  }
  if (context.cleanupBeforeDevelop) {
    await cleanUp();
    await postInstall({
      skipGo: context.options.skipGo,
      skipNuxt: context.options.skipNuxt,
    });
    return;
  }
  if (!existsSync(join(cwd, "vue/.nuxt")) || !existsSync(join(cwd, "go.sum"))) {
    await cleanUp();
    await postInstall({
      skipGo: context.options.skipGo,
      skipNuxt: context.options.skipNuxt,
    });
  }
}

async function runNuxtDev(serverConfig: ServerConfigJson) {
  await concurrently([
    {
      command: `npx nuxt dev --port=${serverConfig.nuxtPort} --host`,
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;
}

async function runGoDev(serverConfig: ServerConfigJson) {
  ensureDirSync(join(cwd, ".build/.server"));
  await startGoDev(serverConfig.ginPort);
}

/**
 * 启动本地开发环境。
 *
 * 行为包括：按配置执行预清理、释放开发端口、并行启动 Nuxt 与 Go 监听流程。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function develop(options: DevelopOptions = {}) {
  printCommandBanner("dev", "Start Nuxt and Go development workflows");
  const context = await resolveDevelopContext(options);
  const actions: string[] = [];
  await prepareDevelop(context);
  // 在开发前确保占用端口被释放
  if (context.killPortBeforeDevelop) {
    killPorts([
      context.options.skipGo ? undefined : context.serverConfig.ginPort,
      context.options.skipNuxt ? undefined : context.serverConfig.nuxtPort,
    ]);
    actions.push("released occupied development ports");
  }
  const tasks: Array<Promise<void>> = [];
  if (!context.options.skipGo) {
    tasks.push(runGoDev(context.serverConfig));
    actions.push(`started Go watcher on port ${context.serverConfig.ginPort}`);
  }
  if (!context.options.skipNuxt) {
    tasks.push(runNuxtDev(context.serverConfig));
    actions.push(`started Nuxt dev server on port ${context.serverConfig.nuxtPort}`);
  }
  if (context.options.skipGo) {
    actions.push("skipped Go workflow");
  }
  if (context.options.skipNuxt) {
    actions.push("skipped Nuxt workflow");
  }
  printCommandSummary("dev", actions);
  await Promise.all(tasks);
}

/**
 * 仅启动 Nuxt 开发服务（带 nuxt 标签输出）。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function developNuxt(options: DevelopOptions = {}) {
  printCommandBanner("dev:nuxt", "Start Nuxt development server only");
  const context = await resolveDevelopContext({
    ...options,
    skipGo: true,
  });
  const actions: string[] = [];
  await prepareDevelop({
    ...context,
    options: {
      ...context.options,
      skipGo: true,
    },
  });
  if (context.killPortBeforeDevelop) {
    killPorts([context.serverConfig.nuxtPort]);
    actions.push("released Nuxt dev port");
  }
  actions.push(`started Nuxt dev server on port ${context.serverConfig.nuxtPort}`);
  printCommandSummary("dev:nuxt", actions);
  await runNuxtDev(context.serverConfig);
}

/**
 * 仅启动 Go 开发监听流程。
 *
 * @returns {Promise<void>} 仅在开发进程退出或出现异常时返回。
 */
export async function developGo(options: DevelopOptions = {}) {
  printCommandBanner("dev:go", "Start Go watcher only");
  const context = await resolveDevelopContext({
    ...options,
    skipNuxt: true,
  });
  const actions: string[] = [];
  await prepareDevelop({
    ...context,
    options: {
      ...context.options,
      skipNuxt: true,
    },
  });
  if (context.killPortBeforeDevelop) {
    killPorts([context.serverConfig.ginPort]);
    actions.push("released Go server port");
  }
  actions.push(`started Go watcher on port ${context.serverConfig.ginPort}`);
  printCommandSummary("dev:go", actions);
  await runGoDev(context.serverConfig);
}

export default develop;
