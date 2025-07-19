import { ensureDirSync, ensureFileSync } from "fs-extra";
import { join } from "path";
import concurrently from "concurrently";

const cwd = process.cwd();

export function build() {
  ensureDirSync(join(cwd, "vue/.output"));
  ensureFileSync(join(cwd, "tmp/production.exe"));
  concurrently(["go build -o ./tmp/production.exe .", "nuxt generate"]);
}

export default build;
