const { execFileSync } = require("node:child_process");
const { input } = require("@inquirer/prompts");
const concurrently = require("concurrently");
const { copySync, readFileSync, removeSync, writeFileSync } = require("fs-extra");

const DIST_DIR = "dist";
const DIST_PACKAGE_JSON_PATH = `${DIST_DIR}/package.json`;
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][\da-zA-Z-]*))*))?(?:\+([\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*))?$/;

function readRootPackageJson() {
  return JSON.parse(readFileSync("package.json", "utf-8"));
}

function isInteractiveTerminal() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function incrementPatchVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return version;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]) + 1;
  return `${major}.${minor}.${patch}`;
}

function readLatestPublishedVersion(packageName) {
  try {
    return execFileSync("npm", ["view", packageName, "version"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

async function resolveBuildVersion(rootPackageJson) {
  const publishedVersion = readLatestPublishedVersion(rootPackageJson.name);
  const suggestedVersion = SEMVER_REGEX.test(publishedVersion ?? "")
    ? incrementPatchVersion(publishedVersion)
    : rootPackageJson.version;

  if (!isInteractiveTerminal()) {
    return suggestedVersion;
  }

  return input({
    message: `Package version ${publishedVersion ? `(latest published: ${publishedVersion})` : ""}`.trim(),
    default: suggestedVersion,
    validate(value) {
      if (!SEMVER_REGEX.test(value.trim())) {
        return "Version must be a valid semver string like 0.3.4 or 1.0.0-beta.1";
      }
      return true;
    },
  });
}

function buildDistPackageJson(rootPackageJson, version) {
  // Keep the published package manifest minimal and avoid leaking dev-only scripts.
  return {
    name: rootPackageJson.name,
    version,
    description: rootPackageJson.description,
    bin: rootPackageJson.bin,
    keywords: rootPackageJson.keywords,
    author: rootPackageJson.author,
    license: rootPackageJson.license,
    dependencies: rootPackageJson.dependencies,
  };
}

function writeDistPackageJson(version) {
  const distPackageJson = buildDistPackageJson(readRootPackageJson(), version);
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
  const rootPackageJson = readRootPackageJson();
  const version = await resolveBuildVersion(rootPackageJson);

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
  writeDistPackageJson(version);
  copySync("README.md", `${DIST_DIR}/README.md`);
  copySync("LICENSE", `${DIST_DIR}/LICENSE`);
  copySync("src/assets/go-gin-server.json", `${DIST_DIR}/src/assets/go-gin-server.json`);
  copySync("src/assets/server-config.schema.json", `${DIST_DIR}/src/assets/server-config.schema.json`);
  copySync("src/assets/pack-config.schema.json", `${DIST_DIR}/src/assets/pack-config.schema.json`);

  // Fix up generated declarations after TypeScript emit finishes.
  handleNuxtConfig();
}

void buildPackage();
