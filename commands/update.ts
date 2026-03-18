import concurrently from "concurrently";

export type UpdateOptions = {
  latest?: boolean;
  skipGo?: boolean;
  skipNode?: boolean;
};

export function update(options: UpdateOptions = {}) {
  const commands = [];

  if (!options.skipNode) {
    commands.push({
      command: options.latest ? "pnpm update --latest" : "pnpm update",
      name: "pnpm",
      prefixColor: "magenta" as const,
    });
  }
  if (!options.skipGo) {
    commands.push({
      command: options.latest ? "go get -u ./... && go mod tidy" : "go get -u=patch ./... && go mod tidy",
      name: "go",
      prefixColor: "green" as const,
    });
  }

  if (commands.length === 0) {
    return Promise.resolve();
  }

  return concurrently(commands).result;
}

export default update;
