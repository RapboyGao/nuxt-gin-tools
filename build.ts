import concurrently from "concurrently";
import { copySync, removeSync } from "fs-extra";

export async function build() {
  // 执行并发命令
  await concurrently([
    {
      command: "tsc",
      name: "build",
      prefixColor: "green",
    },
  ]).result;

  copySync("package.json", "dist/package.json");
  copySync("README.md", "dist/README.md");
  copySync("LICENSE", "dist/LICENSE");
  copySync("src/go-gin-server.json", "dist/src/go-gin-server.json");
  removeSync("dist/build.js");
  removeSync("dist/build.d.ts");
}

build();
