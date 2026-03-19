import chalk from "chalk";

function line(width = 64): string {
  return "═".repeat(width);
}

export function printCommandBanner(command: string, subtitle: string) {
  const head = chalk.bgBlue.black(` ${command.toUpperCase()} `);
  const border = chalk.blueBright(line());
  const title = chalk.bold.white(`nuxt-gin-tools ${head}`);
  const detail = chalk.cyan(subtitle);

  console.log("");
  console.log(border);
  console.log(title);
  console.log(detail);
  console.log(border);
}

export function printCommandSuccess(command: string, message: string) {
  console.log(chalk.green(`✔ ${command}: ${message}`));
}

export function printCommandInfo(label: string, message: string) {
  console.log(chalk.blueBright(`ℹ ${label}: ${message}`));
}

export function printCommandWarn(message: string) {
  console.warn(chalk.yellow(`⚠ ${message}`));
}
