import concurrently from "concurrently";
import { spawnSync } from "node:child_process";
import { mergeDefined, resolveNuxtGinProjectConfig } from "../../nuxt-gin";
import { selectWithDefault } from "../prompt";
import {
  printCommandBanner,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../terminal-ui";

export type PostInstallOptions = {
  skipGo?: boolean;
  skipNuxt?: boolean;
};

type InstallMode = "full" | "nuxt-only" | "go-only";

function hasExplicitInstallOptions(options?: PostInstallOptions): boolean {
  return Boolean(options?.skipGo !== undefined || options?.skipNuxt !== undefined);
}

async function resolveInstallOptions(
  options: PostInstallOptions = {},
  configuredOptions: PostInstallOptions = {},
): Promise<PostInstallOptions> {
  if (hasExplicitInstallOptions(options)) {
    return options;
  }
  if (configuredOptions.skipGo !== undefined || configuredOptions.skipNuxt !== undefined) {
    return options;
  }

  const mode = await selectWithDefault<InstallMode>({
    label: "install",
    message: "Choose install workflow",
    defaultValue: "full",
    nonInteractiveMessage: "Non-interactive terminal detected, using default install workflow: full",
    options: [
      {
        label: "Nuxt + Go",
        value: "full",
        hint: "Prepare Nuxt runtime and download Go modules",
      },
      {
        label: "Nuxt only",
        value: "nuxt-only",
        hint: "Only run Nuxt prepare",
      },
      {
        label: "Go only",
        value: "go-only",
        hint: "Only download and tidy Go modules",
      },
    ],
  });

  return {
    skipGo: mode === "nuxt-only",
    skipNuxt: mode === "go-only",
  };
}

export async function postInstall(options: PostInstallOptions = {}) {
  printCommandBanner("install", "Prepare Nuxt and optional Go dependencies");
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const configuredOptions = projectConfig.config.install ?? {};
  const promptedOptions = await resolveInstallOptions(options, configuredOptions);
  const resolvedOptions = mergeDefined<PostInstallOptions>(
    configuredOptions,
    promptedOptions,
  );
  const actions: string[] = [];
  const commands = [];
  const hasGo =
    spawnSync("go", ["version"], { stdio: "ignore", shell: true }).status ===
    0;
  if (!resolvedOptions.skipNuxt) {
    actions.push("prepared Nuxt runtime");
    commands.push({
      command: "npx nuxt prepare",
      name: "nuxt",
      prefixColor: "blue",
    });
  }

  if (!resolvedOptions.skipGo && hasGo) {
    actions.push("downloaded and tidied Go modules");
    commands.push({
      command: "go mod download && go mod tidy",
      name: "go",
      prefixColor: "green",
    });
  } else if (!resolvedOptions.skipGo) {
    printCommandWarn("Go was not detected, skipping Go dependency bootstrap");
    actions.push("skipped Go bootstrap because Go was not detected");
  } else {
    actions.push("skipped Go bootstrap by option");
  }
  if (resolvedOptions.skipNuxt) {
    actions.push("skipped Nuxt prepare by option");
  }
  if (commands.length === 0) {
    printCommandWarn("Nothing selected for install, skipping bootstrap");
    printCommandSummary("install", actions.length > 0 ? actions : ["nothing was executed"]);
    return Promise.resolve();
  }

  // 执行并发命令
  return concurrently(commands).result.then(() => {
    printCommandSuccess("install", "Project bootstrap completed");
    printCommandSummary("install", actions);
  });
}

export default postInstall;
