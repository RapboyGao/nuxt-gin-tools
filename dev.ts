import concurrently from "concurrently";
import { readJSONSync } from "fs-extra";
import { join } from "path";

const cwd = process.cwd();
const serverConfig = readJSONSync(join(cwd, "server.config.json"));

concurrently([
  {
    command: `nuxt dev --port ${serverConfig.port}`,
    name: "nuxt",
    prefixColor: "yellow",
  },
]);
