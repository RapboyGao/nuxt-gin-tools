import concurrently from "concurrently";

export function postInstall() {
  // 执行并发命令
  concurrently([
    {
      command: "go mod download && go mod tidy",
      name: "go",
      prefixColor: "green",
    },
    {
      command: "nuxt prepare",
      name: "nuxt",
      prefixColor: "blue",
    },
  ]);
}

export default postInstall;
