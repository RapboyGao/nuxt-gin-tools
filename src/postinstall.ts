import concurrently from "concurrently";

export function postInstall() {
  // 执行并发命令
  return concurrently([
    {
      command: "go mod download && go mod tidy",
      name: "go",
      prefixColor: "green",
    },
    {
      command: "npx nuxt prepare",
      name: "nuxt",
      prefixColor: "blue",
    },
  ]).result;
}

export default postInstall;
