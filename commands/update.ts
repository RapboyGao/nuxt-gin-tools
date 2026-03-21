import concurrently from "concurrently";
import { detectPackageManager, packageManagerUpdateCommand } from "../src/package-manager";
import { printCommandBanner, printCommandSuccess, printCommandWarn } from "../src/terminal-ui";

export type UpdateOptions = {
  latest?: boolean;
  skipGo?: boolean;
  skipNode?: boolean;
};

export function update(options: UpdateOptions = {}) {
  printCommandBanner("update", "Update Node and Go dependencies");
  const commands = [];
  const packageManager = detectPackageManager();

  if (!options.skipNode) {
    commands.push({
      command: packageManagerUpdateCommand(packageManager, options.latest === true),
      name: packageManager,
      prefixColor: "magenta" as const,
    });
  }
  if (!options.skipGo) {
    commands.push({
      command: options.latest ? "go get -u ./... && go mod tidy" : "go get -u=patch ./... && go mod tidy",
      name: "go",
      prefixColor: "green" as const,
    });
  }

  if (commands.length === 0) {
    printCommandWarn("No update targets selected, nothing to do");
    return Promise.resolve();
  }

  return concurrently(commands).result.then(() => {
    printCommandSuccess("update", "Dependency update completed");
  });
}

export default update;
