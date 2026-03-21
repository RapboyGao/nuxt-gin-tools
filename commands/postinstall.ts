import concurrently from "concurrently";
import { spawnSync } from "node:child_process";
import { mergeDefined, resolveNuxtGinProjectConfig } from "../src/nuxt-gin";
import {
  printCommandBanner,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../src/terminal-ui";

export type PostInstallOptions = {
  skipGo?: boolean;
  skipNuxt?: boolean;
};

export function postInstall(options: PostInstallOptions = {}) {
  printCommandBanner("install", "Prepare Nuxt and optional Go dependencies");
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const resolvedOptions = mergeDefined<PostInstallOptions>(
    projectConfig.config.install,
    options,
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
