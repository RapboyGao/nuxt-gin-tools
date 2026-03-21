import { existsSync } from "fs-extra";
import { join } from "path";

export type PackageManager = "bun" | "pnpm" | "npm";

const cwd = process.cwd();

export function detectPackageManager(): PackageManager {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  return "npm";
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
    default:
      return latest ? "npm update" : "npm update";
  }
}
