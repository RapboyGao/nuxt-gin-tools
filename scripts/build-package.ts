import concurrently from "concurrently";
import { copySync, readFileSync, removeSync, writeFileSync } from "fs-extra";

type PackageJson = {
  name: string;
  version: string;
  description?: string;
  bin?: Record<string, string>;
  keywords?: string[];
  author?: string;
  license?: string;
  dependencies?: Record<string, string>;
};

const DIST_DIR = "dist";
const DIST_PACKAGE_JSON_PATH = `${DIST_DIR}/package.json`;

function readRootPackageJson(): PackageJson {
  return JSON.parse(readFileSync("package.json", "utf-8")) as PackageJson;
}

function buildDistPackageJson(rootPackageJson: PackageJson): PackageJson {
  return {
    name: rootPackageJson.name,
    version: rootPackageJson.version,
    description: rootPackageJson.description,
    bin: rootPackageJson.bin,
    keywords: rootPackageJson.keywords,
    author: rootPackageJson.author,
    license: rootPackageJson.license,
    dependencies: rootPackageJson.dependencies,
  };
}

function writeDistPackageJson() {
  const distPackageJson = buildDistPackageJson(readRootPackageJson());
  writeFileSync(DIST_PACKAGE_JSON_PATH, `${JSON.stringify(distPackageJson, null, 2)}\n`);
}

export async function handleNuxtConfig() {
  let contents = readFileSync("./dist/src/nuxt-config.d.ts", "utf-8");
  if (!contents.includes(`import type { NuxtConfig } from "nuxt/config";`)) {
    contents = `import type { NuxtConfig } from "nuxt/config";\n` + contents;
  }
  contents = contents.replace(
    /export declare function createDefaultConfig\((?:.|\n)*?\n\};/gm,
    `export function createDefaultConfig(config: MyNuxtConfig): NuxtConfig;`,
  );
  writeFileSync("./dist/src/nuxt-config.d.ts", contents);
}

export async function buildPackage() {
  removeSync(DIST_DIR);
  await concurrently([
    {
      command: "tsc",
      name: "build",
      prefixColor: "green",
    },
  ]).result;

  writeDistPackageJson();
  copySync("README.md", `${DIST_DIR}/README.md`);
  copySync("LICENSE", `${DIST_DIR}/LICENSE`);
  copySync("src/assets/go-gin-server.json", `${DIST_DIR}/src/assets/go-gin-server.json`);
  copySync("src/assets/server-config.schema.json", `${DIST_DIR}/src/assets/server-config.schema.json`);
  copySync("src/assets/pack-config.schema.json", `${DIST_DIR}/src/assets/pack-config.schema.json`);
  await handleNuxtConfig();
}

void buildPackage();
