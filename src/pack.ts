import Zip from "7zip-min";
import Chalk from "chalk";
import Fs from "fs-extra";
import Path from "path";
import build from "./builder";

const cwd = process.cwd();

/**
 * @param  {...string} names 路径名称
 * @returns 相对于Workspace位置的路径名称
 */
function p(...names: string[]) {
  return Path.join(cwd, ...names);
}

/** 打包文件夹相对于Workspace位置 */
const BUILD_DEST = ".build/server";

/** 需要打包的文件相对位置列表 */
const FILE_LIST = ["vue/.output", "tmp/production.exe", "ecosystem.config.js", "server.config.json"];

/** package.json 文件夹相对于Workspace位置 */
const PACKAGE_JSON = BUILD_DEST + "/package.json";
/** 打包package.7z位置 */
const _7Z_PATH = BUILD_DEST + "/../package.7z";
/** 打包package.7z相对位置 */
const _7Z_PATH_RELATIVE = Path.relative(cwd, _7Z_PATH);

/** package.json 内容 */
const PACKAGE_JSON_CONTENT = {
  private: true,
  scripts: {
    start: "./tmp/production.exe",
  },
};

/**
 * 把FILE_LIST中的文件拷贝到DIST_PACKAGE的对应位置
 */
function copyFiles() {
  for (const path of FILE_LIST) {
    const pathFrom = p(path);
    const pathTo = p(BUILD_DEST, path);
    Fs.copySync(pathFrom, pathTo);
  }
}

function writeScriptFiles() {
  Fs.outputFileSync(p(BUILD_DEST, "start.bat"), `powershell -ExecutionPolicy ByPass -File ./start.ps1`);
  Fs.outputFileSync(p(BUILD_DEST, "start.ps1"), `./tmp/production.exe`);
  Fs.outputFileSync(p(BUILD_DEST, "start.sh"), `./tmp/production.exe`);
}
/**
 * 打包文件为7z格式
 */
async function pack() {
  Fs.removeSync(p(BUILD_DEST));
  Fs.removeSync(p(_7Z_PATH));
  copyFiles();
  writeScriptFiles();
  Fs.outputJSONSync(p(PACKAGE_JSON), PACKAGE_JSON_CONTENT, { spaces: 2 });
  Zip.pack(p(BUILD_DEST), p(_7Z_PATH), () => {
    Fs.removeSync(p(BUILD_DEST));
  });
}

/**
 * 先generate，让后打包
 */
export async function buildAndPack() {
  await build();
  await pack();
  console.log(Chalk.bgGreen("打包完成!", _7Z_PATH_RELATIVE));
}

export default buildAndPack;
