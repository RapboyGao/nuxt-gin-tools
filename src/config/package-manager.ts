import { existsSync } from "fs-extra";
import { join } from "path";

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm" | "cnpm";
export type PackageManagerSelection = PackageManager | "auto";
export const PACKAGE_MANAGER_SELECTIONS = ["auto", "bun", "pnpm", "yarn", "npm", "cnpm"] as const;

const cwd = process.cwd();

export function detectPackageManager(): PackageManager {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

export function resolvePackageManager(selection: PackageManagerSelection): PackageManager {
  if (selection === "auto") {
    return detectPackageManager();
  }
  return selection;
}

export function isPackageManagerSelection(value: string): value is PackageManagerSelection {
  return (PACKAGE_MANAGER_SELECTIONS as readonly string[]).includes(value);
}

export function packageManagerUpdateCommand(
  packageManager: PackageManager,
  latest: boolean,
): string {
  switch (packageManager) {
    case "bun":
      return latest ? "bun update --latest" : "bun update";
    case "pnpm":
      return latest ? "pnpm update --latest" : "pnpm update";
    case "yarn":
      return latest ? `yarn up "*" "@*/*"` : `yarn up -R "*" "@*/*"`;
    case "cnpm":
      return "cnpm update";
    default:
      return "npm update";
  }
}
