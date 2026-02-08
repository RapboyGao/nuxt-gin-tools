import concurrently from "concurrently";
import { copySync, readFileSync, writeFileSync } from "fs-extra";

export async function handleNuxtConfig() {
  let contents = readFileSync("./dist/src/nuxt-config.d.ts", "utf-8");
  contents = `import type { NuxtConfig } from "nuxt/config";\n` + contents;
  contents = contents.replace(
    /export declare function createDefaultConfig\(\{ serverConfig, apiBasePath \}: MyNuxtConfig\)\:(.*|\n)+/gm,
    `export function createDefaultConfig({ serverConfig, apiBasePath }: MyNuxtConfig): NuxtConfig;`
  );
  writeFileSync("./dist/src/nuxt-config.d.ts", contents);
}

export async function build() {
  copySync("package.json", "dist/package.json");
  copySync("README.md", "dist/README.md");
  copySync("LICENSE", "dist/LICENSE");
  copySync("src/go-gin-server.json", "dist/src/go-gin-server.json");
  copySync("src/server-config.json", "dist/src/server-config.json");
  copySync("src/pack-config.schema.json", "dist/src/pack-config.schema.json");
  copySync(".go-watch.json", "dist/.go-watch.json");
  // 执行并发命令
  await concurrently([
    {
      command: "tsc",
      name: "build",
      prefixColor: "green",
    },
  ]).result;

  await handleNuxtConfig();
}

build();
