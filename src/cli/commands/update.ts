import concurrently from "concurrently";
import {
  packageManagerUpdateCommand,
  resolvePackageManager,
  type PackageManagerSelection,
} from "../../config/package-manager";
import {
  mergeDefined,
  resolveNuxtGinProjectConfig,
} from "../../nuxt-gin";
import {
  printCommandBanner,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../terminal-ui";

export type UpdateOptions = {
  latest?: boolean;
  packageManager?: PackageManagerSelection;
  skipGo?: boolean;
  skipNode?: boolean;
};

export function update(options: UpdateOptions = {}) {
  printCommandBanner("update", "Update Node and Go dependencies");
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const resolvedOptions = mergeDefined<UpdateOptions>(
    {
      latest: false,
      packageManager: "auto",
      ...(projectConfig.config.update ?? {}),
    },
    options,
  );
  const actions: string[] = [];
  const commands = [];
  const packageManager = resolvePackageManager(resolvedOptions.packageManager ?? "auto");
  const latest = resolvedOptions.latest === true;

  if (!resolvedOptions.skipNode) {
    actions.push(
      `updated Node dependencies with ${packageManager} (${latest ? "latest" : "conservative"} mode)`,
    );
    commands.push({
      command: packageManagerUpdateCommand(packageManager, latest),
      name: packageManager,
      prefixColor: "magenta" as const,
    });
  }
  if (!resolvedOptions.skipGo) {
    actions.push(
      `updated Go modules with ${latest ? "latest" : "patch"} strategy`,
    );
    commands.push({
      command: latest ? "go get -u ./... && go mod tidy" : "go get -u=patch ./... && go mod tidy",
      name: "go",
      prefixColor: "green" as const,
    });
  }
  if (resolvedOptions.skipNode) {
    actions.push("skipped Node dependency update");
  }
  if (resolvedOptions.skipGo) {
    actions.push("skipped Go dependency update");
  }

  if (commands.length === 0) {
    printCommandWarn("No update targets selected, nothing to do");
    printCommandSummary("update", actions.length > 0 ? actions : ["nothing was executed"]);
    return Promise.resolve();
  }

  return concurrently(commands).result.then(() => {
    printCommandSuccess("update", "Dependency update completed");
    printCommandSummary("update", actions);
  });
}

export default update;
