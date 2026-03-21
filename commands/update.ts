import concurrently from "concurrently";
import {
  packageManagerUpdateCommand,
  resolvePackageManager,
  type PackageManagerSelection,
} from "../src/package-manager";
import {
  printCommandBanner,
  printCommandSuccess,
  printCommandSummary,
  printCommandWarn,
} from "../src/terminal-ui";

export type UpdateOptions = {
  latest: boolean;
  packageManager: PackageManagerSelection;
  skipGo?: boolean;
  skipNode?: boolean;
};

export function update(options: UpdateOptions) {
  printCommandBanner("update", "Update Node and Go dependencies");
  const actions: string[] = [];
  const commands = [];
  const packageManager = resolvePackageManager(options.packageManager);

  if (!options.skipNode) {
    actions.push(
      `updated Node dependencies with ${packageManager} (${options.latest ? "latest" : "conservative"} mode)`,
    );
    commands.push({
      command: packageManagerUpdateCommand(packageManager, options.latest),
      name: packageManager,
      prefixColor: "magenta" as const,
    });
  }
  if (!options.skipGo) {
    actions.push(
      `updated Go modules with ${options.latest ? "latest" : "patch"} strategy`,
    );
    commands.push({
      command: options.latest ? "go get -u ./... && go mod tidy" : "go get -u=patch ./... && go mod tidy",
      name: "go",
      prefixColor: "green" as const,
    });
  }
  if (options.skipNode) {
    actions.push("skipped Node dependency update");
  }
  if (options.skipGo) {
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
