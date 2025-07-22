import concurrently from "concurrently";
import { ensureDirSync, ensureFileSync } from "fs-extra";
import { join } from "path";

const cwd = process.cwd();

export function build() {
  ensureDirSync(join(cwd, "vue/.output"));
  ensureFileSync(join(cwd, ".build/.server/production.exe"));
  return concurrently([
    {
      command: "go build -o ./.build/.server/production.exe .",
      name: "go",
      prefixColor: "green",
    },
    {
      command: "npx nuxt generate",
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;
}

export default build;
