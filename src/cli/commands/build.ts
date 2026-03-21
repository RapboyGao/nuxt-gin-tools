import type { PackConfig } from "../../pack";
import { resolveNuxtGinProjectConfig } from "../../nuxt-gin";
import { confirmWithDefault, selectWithDefault } from "../prompt";
import { buildAndPack as runBuildAndPack } from "../../services/pack-service";

export {
  BUILD_EXECUTABLE,
  FILES_TO_COPY,
  LEGACY_PACK_CONFIG_CJS_PATH,
  LEGACY_PACK_CONFIG_JS_PATH,
  LEGACY_PACK_CONFIG_MJS_PATH,
  LEGACY_PACK_CONFIG_PATH,
  LEGACY_PACK_CONFIG_TS_PATH,
  ORIGINAL_DIST_PATH,
  PACKAGE_JSON_CONTENT,
  SERVER_EXECUTABLE,
  SERVER_PATH,
  ZIP_PATH,
  builtPath,
} from "../../services/pack-service";

type BuildMode = "full" | "build-only" | "pack-only" | "bundle-only";

function hasExplicitBuildOptions(config?: PackConfig): boolean {
  return Boolean(
    config?.binaryName !== undefined ||
      config?.skipGo !== undefined ||
      config?.skipNuxt !== undefined ||
      config?.skipBuild !== undefined ||
      config?.skipZip !== undefined,
  );
}

async function promptForBuildConfig(baseConfig: PackConfig = {}): Promise<PackConfig> {
  const configuredOptions = resolveNuxtGinProjectConfig().config.pack ?? {};
  const resolvedFromPrompt: PackConfig = { ...baseConfig };
  const effectiveSkipBuild = baseConfig.skipBuild ?? configuredOptions.skipBuild;
  const effectiveSkipZip = baseConfig.skipZip ?? configuredOptions.skipZip;

  if (effectiveSkipBuild === undefined || effectiveSkipZip === undefined) {
    const mode = await selectWithDefault<BuildMode>({
      label: "build",
      message: "Choose build workflow",
      defaultValue: "full",
      nonInteractiveMessage: "Non-interactive terminal detected, using default build workflow: full",
      options: [
        {
          label: "Full build + pack",
          value: "full",
          hint: "Build Go and Nuxt, assemble bundle, then create 7z archive",
        },
        {
          label: "Build only",
          value: "build-only",
          hint: "Build artifacts and assemble bundle, but skip 7z archive",
        },
        {
          label: "Pack existing build",
          value: "pack-only",
          hint: "Reuse existing artifacts and only assemble bundle + 7z archive",
        },
        {
          label: "Bundle only",
          value: "bundle-only",
          hint: "Reuse existing artifacts and only assemble bundle directory",
        },
      ],
    });

    if (effectiveSkipBuild === undefined) {
      resolvedFromPrompt.skipBuild = mode === "pack-only" || mode === "bundle-only";
    }
    if (effectiveSkipZip === undefined) {
      resolvedFromPrompt.skipZip = mode === "build-only" || mode === "bundle-only";
    }
  }

  const finalSkipBuild = resolvedFromPrompt.skipBuild ?? effectiveSkipBuild ?? false;

  if (!finalSkipBuild && baseConfig.skipGo === undefined && configuredOptions.skipGo === undefined) {
    resolvedFromPrompt.skipGo = !(await confirmWithDefault({
      label: "build",
      message: "Include Go build step?",
      defaultValue: true,
      nonInteractiveMessage: "Non-interactive terminal detected, including Go build step by default",
    }));
  }

  if (!finalSkipBuild && baseConfig.skipNuxt === undefined && configuredOptions.skipNuxt === undefined) {
    resolvedFromPrompt.skipNuxt = !(await confirmWithDefault({
      label: "build",
      message: "Include Nuxt build step?",
      defaultValue: true,
      nonInteractiveMessage: "Non-interactive terminal detected, including Nuxt build step by default",
    }));
  }

  if (baseConfig.writeScripts === undefined && configuredOptions.writeScripts === undefined) {
    resolvedFromPrompt.writeScripts = await confirmWithDefault({
      label: "build",
      message: "Generate startup scripts in bundle output?",
      defaultValue: true,
      nonInteractiveMessage:
        "Non-interactive terminal detected, generating startup scripts by default",
    });
  }

  return resolvedFromPrompt;
}

export async function buildAndPack(config?: PackConfig) {
  const resolvedConfig = hasExplicitBuildOptions(config)
    ? config
    : await promptForBuildConfig(config);
  return runBuildAndPack(resolvedConfig);
}

export default buildAndPack;
