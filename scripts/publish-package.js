const { execFileSync } = require("node:child_process");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

function publishPackage() {
  const publishArgs = process.argv.slice(2);

  // Always build first so dist stays in sync with the current source tree.
  run("npm", ["run", "build"]);

  // Publish from dist so the root package metadata and dev files stay out of the release.
  run("npm", ["publish", "--access", "public", ...publishArgs], {
    cwd: "dist",
  });
}

publishPackage();
