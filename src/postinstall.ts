import concurrently from "concurrently";
import { spawnSync } from "node:child_process";

export function postInstall() {
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
      command:
        "go mod download && go mod tidy && go install github.com/cosmtrek/air@latest",
      name: "go",
      prefixColor: "green",
    });
  } else {
    console.warn(
      "[nuxt-gin-tools] 未检测到 Go，已跳过 Go 相关安装。请先安装 Go 后再重新运行相关命令。"
    );
  }

  // 执行并发命令
  return concurrently(commands).result;
}

export default postInstall;
