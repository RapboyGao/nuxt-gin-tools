import concurrently from "concurrently";
import { spawnSync } from "node:child_process";
import { printCommandBanner, printCommandSuccess, printCommandWarn } from "../src/terminal-ui";

export function postInstall() {
  printCommandBanner("install", "Prepare Nuxt and optional Go dependencies");
  const hasGo =
    spawnSync("go", ["version"], { stdio: "ignore", shell: true }).status ===
    0;
  const commands = [
    {
      command: "npx nuxt prepare",
      name: "nuxt",
      prefixColor: "blue",
    },
  ];

  if (hasGo) {
    commands.unshift({
      command: "go mod download && go mod tidy",
      name: "go",
      prefixColor: "green",
    });
  } else {
    printCommandWarn("Go was not detected, skipping Go dependency bootstrap");
  }

  // 执行并发命令
  return concurrently(commands).result.then(() => {
    printCommandSuccess("install", "Project bootstrap completed");
  });
}

export default postInstall;
