import concurrently from "concurrently";
import { copySync, removeSync } from "fs-extra";
concurrently(["tsc"]);
copySync("package.json", "dist/package.json");
removeSync("dist/build.js");
removeSync("dist/build.d.ts");
