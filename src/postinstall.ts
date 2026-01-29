import concurrently from "concurrently";
import { spawnSync } from "node:child_process";

export function postInstall() {
  const hasGo =
    spawnSync("go", ["version"], { stdio: "ignore", shell: true }).status ===
    0;
  const hasAir =
    spawnSync("air", ["-v"], { stdio: "ignore", shell: true }).status === 0;
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
    console.warn(
      "[nuxt-gin-tools] 未检测到 Go，已跳过 Go 相关安装。请先安装 Go 后再重新运行相关命令。"
    );
  }

  if (!hasAir) {
    const isWindows = process.platform === "win32";
    const pathHint = isWindows
      ? [
          "PowerShell: $env:Path += \";$env:USERPROFILE\\go\\bin\"",
          "CMD: set PATH=%PATH%;%USERPROFILE%\\go\\bin",
        ].join(" | ")
      : "export PATH=\"$PATH:$HOME/go/bin\"";
    console.warn(
      [
        "[nuxt-gin-tools] 未检测到 air，请先安装 1.63.0 版本并加入 PATH。",
        "安装命令: go install github.com/cosmtrek/air@v1.63.0",
        `PATH 示例: ${pathHint}`,
        "安装完成后请执行: air -v",
      ].join("\n")
    );
  }

  // 执行并发命令
  return concurrently(commands).result;
}

export default postInstall;
