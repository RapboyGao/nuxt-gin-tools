import concurrently from "concurrently";

export function update() {
  concurrently([
    {
      command: "pnpm update --latest",
      name: "pnpm",
      prefixColor: "blue",
    },
    {
      command: "go get -u && go mod tidy",
      name: "go",
      prefixColor: "green",
    },
  ]);
}

export default update;
