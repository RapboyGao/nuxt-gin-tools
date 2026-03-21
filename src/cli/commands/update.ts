import concurrently from "concurrently";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
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

function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function collectGoPackages(): string[] {
  try {
    const output = execFileSync(
      "go",
      [
        "list",
        "./...",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    const packages = output
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !item.includes("/vendor/") && !item.endsWith("/vendor"));

    return packages.length > 0 ? packages : ["./..."];
  } catch {
    return ["./..."];
  }
}

function buildGoUpdateCommand(latest: boolean): string {
  const packageDirs = collectGoPackages().map((dir) => quoteShellArg(dir)).join(" ");
  const goGetCommand = latest
    ? `go get -u ${packageDirs}`
    : `go get -u=patch ${packageDirs}`;
  return `${goGetCommand} && go mod tidy`;
}

async function resolveLatestPreference(options: UpdateOptions): Promise<boolean> {
  if (typeof options.latest === "boolean") {
    return options.latest;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    printCommandWarn("Non-interactive terminal detected, defaulting update mode to conservative");
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question("Use latest dependency upgrade strategy? [y/N] ");
    const normalized = answer.trim().toLowerCase();
    return ["y", "yes"].includes(normalized);
  } finally {
    rl.close();
  }
}

export async function update(options: UpdateOptions = {}) {
  printCommandBanner("update", "Update Node and Go dependencies");
  const projectConfig = resolveNuxtGinProjectConfig();
  for (const warning of projectConfig.warnings) {
    printCommandWarn(`[config] ${warning}`);
  }
  const resolvedOptions = mergeDefined<UpdateOptions>(
    {
      packageManager: "auto",
      ...(projectConfig.config.update ?? {}),
    },
    options,
  );
  const latest = await resolveLatestPreference(resolvedOptions);
  const actions: string[] = [];
  const commands = [];
  const packageManager = resolvePackageManager(resolvedOptions.packageManager ?? "auto");

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
      command: buildGoUpdateCommand(latest),
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
    return;
  }

  await concurrently(commands).result;
  printCommandSuccess("update", "Dependency update completed");
  printCommandSummary("update", actions);
}

export default update;
