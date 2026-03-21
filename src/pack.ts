import type { BuildOptions } from "../commands/builder";

export interface PackConfig extends BuildOptions {
  /**
   * 是否跳过构建步骤
   */
  skipBuild?: boolean;
  /**
   * 是否跳过 7z 打包步骤
   */
  skipZip?: boolean;
  /**
   * 额外需要打包的文件映射
   * key: 源文件路径（相对于项目根目录或绝对路径）
   * value: 打包后对应位置（相对于服务器构建目录或绝对路径）
   */
  extraFiles?: Record<string, string>;
  /**
   * 额外需要打包的文件 Glob（相对于项目根目录）
   */
  extraFilesGlobs?: string[];
  /**
   * 排除文件/目录 Glob（相对于项目根目录）
   */
  exclude?: string[];
  /**
   * 打包输出 zip 名称（相对于默认 zip 目录）
   */
  zipName?: string;
  /**
   * 打包输出 zip 路径（相对于项目根目录或绝对路径）
   */
  zipPath?: string;
  /**
   * 服务器构建输出目录（相对于项目根目录或绝对路径）
   */
  serverPath?: string;
  /**
   * 打包前钩子
   */
  beforePack?: () => Promise<void> | void;
  /**
   * 打包后钩子
   */
  afterPack?: (zipPath: string) => Promise<void> | void;
  /**
   * 是否清理 dist
   */
  cleanDist?: boolean;
  /**
   * 是否写入启动脚本和 package.json
   */
  writeScripts?: boolean;
  /**
   * 写入/覆盖 package.json 内容
   */
  packageJson?: Record<string, unknown>;
  /**
   * 复制时是否覆盖同名文件
   */
  overwrite?: boolean;
}

export function createPackConfig(config: PackConfig): PackConfig {
  return config;
}

export default createPackConfig;
