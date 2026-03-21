const concurrently = require("concurrently");
const { copySync, readFileSync, removeSync, writeFileSync } = require("fs-extra");

const DIST_DIR = "dist";
const DIST_PACKAGE_JSON_PATH = `${DIST_DIR}/package.json`;

function readRootPackageJson() {
  return JSON.parse(readFileSync("package.json", "utf-8"));
}

function buildDistPackageJson(rootPackageJson) {
  // Keep the published package manifest minimal and avoid leaking dev-only scripts.
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

function handleNuxtConfig() {
  // Patch the generated declaration so downstream projects always see NuxtConfig imported.
  let contents = readFileSync("./dist/src/nuxt-config.d.ts", "utf-8");
  if (!contents.includes('import type { NuxtConfig } from "nuxt/config";')) {
    contents = 'import type { NuxtConfig } from "nuxt/config";\n' + contents;
  }
  contents = contents.replace(
    /export declare function createDefaultConfig\((?:.|\n)*?\n\};/gm,
    "export function createDefaultConfig(config: MyNuxtConfig): NuxtConfig;",
  );
  writeFileSync("./dist/src/nuxt-config.d.ts", contents);
}

async function buildPackage() {
  // Start from a clean dist directory so removed files do not linger in publish output.
  removeSync(DIST_DIR);

  // Compile the package sources into dist.
  await concurrently([
    {
      command: "tsc",
      name: "build",
      prefixColor: "green",
    },
  ]).result;

  // Copy only the files that should ship with the published package.
  writeDistPackageJson();
  copySync("README.md", `${DIST_DIR}/README.md`);
  copySync("LICENSE", `${DIST_DIR}/LICENSE`);
  copySync("src/assets/go-gin-server.json", `${DIST_DIR}/src/assets/go-gin-server.json`);
  copySync("src/assets/server-config.schema.json", `${DIST_DIR}/src/assets/server-config.schema.json`);
  copySync("src/assets/pack-config.schema.json", `${DIST_DIR}/src/assets/pack-config.schema.json`);

  // Fix up generated declarations after TypeScript emit finishes.
  handleNuxtConfig();
}

void buildPackage();
