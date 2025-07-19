import concurrently from "concurrently";

export function postInstall() {
  // 执行并发命令
  concurrently(["nuxt prepare", "go mod download && go mod tidy"]);
}

export default postInstall;
