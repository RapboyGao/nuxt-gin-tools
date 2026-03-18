import concurrently from "concurrently";
import { ensureDirSync } from "fs-extra";
import { join } from "path";
import os from "os";

const cwd = process.cwd();
const defaultBinaryName = os.platform() === "win32" ? "production.exe" : "production";

export type BuildOptions = {
  binaryName?: string;
  skipGo?: boolean;
  skipNuxt?: boolean;
};

export function build(options: BuildOptions = {}) {
  ensureDirSync(join(cwd, "vue/.output"));
  const commands = [];

  if (!options.skipGo) {
    commands.push({
      command: `go build -o ./.build/.server/${options.binaryName || defaultBinaryName} .`,
      name: "go",
      prefixColor: "green" as const,
    });
  }
  if (!options.skipNuxt) {
    commands.push({
      command: "npx nuxt generate",
      name: "nuxt",
      prefixColor: "blue" as const,
    });
  }
  if (commands.length === 0) {
    return Promise.resolve();
  }
  return concurrently(commands).result;
}

export default build;
