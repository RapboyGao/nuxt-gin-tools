import chalk from "chalk";

type PrintMethod = "log" | "warn" | "error";

const TERMINAL_WIDTH = 72;

function printLine(message: string, method: PrintMethod = "log") {
  if (method === "warn") {
    console.warn(message);
    return;
  }
  if (method === "error") {
    console.error(message);
    return;
  }
  console.log(message);
}

function repeat(char: string, width = TERMINAL_WIDTH): string {
  return char.repeat(width);
}

function formatClock(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function padText(value: string, width: number): string {
  const text = value.length > width ? `${value.slice(0, Math.max(0, width - 1))}…` : value;
  return text + " ".repeat(Math.max(0, width - text.length));
}

function sectionBorder(color: (value: string) => string): string {
  return color(`╭${repeat("─", TERMINAL_WIDTH - 2)}╮`);
}

function sectionFooter(color: (value: string) => string): string {
  return color(`╰${repeat("─", TERMINAL_WIDTH - 2)}╯`);
}

function sectionBody(text: string, color: (value: string) => string): string {
  return color(`│ ${padText(text, TERMINAL_WIDTH - 4)} │`);
}

function printSection(
  lines: string[],
  options: { color: (value: string) => string; method?: PrintMethod },
) {
  if (lines.length === 0) {
    return;
  }
  const method = options.method ?? "log";
  printLine(options.color(``), method);
  printLine(sectionBorder(options.color), method);
  for (const line of lines) {
    printLine(sectionBody(line, options.color), method);
  }
  printLine(sectionFooter(options.color), method);
}

function commandChip(command: string): string {
  return chalk.bgBlueBright.black(` ${command.toUpperCase()} `);
}

function subtleChip(text: string): string {
  return chalk.bgBlackBright.white(` ${text} `);
}

export function printCommandBanner(command: string, subtitle: string) {
  const timestamp = subtleChip(formatClock());
  const title = `nuxt-gin-tools ${commandChip(command)} ${timestamp}`;
  const detail = chalk.cyanBright(subtitle);

  printLine("");
  printSection([title, detail], {
    color: chalk.blueBright,
  });
}

export function printCommandSuccess(command: string, message: string) {
  printLine(chalk.greenBright(`◆ ${chalk.bold(command)} completed`) + chalk.green(`  ${message}`));
}

export function printCommandInfo(label: string, message: string) {
  const head = chalk.bgCyan.black(` ${label.toUpperCase()} `);
  printLine(`${head} ${chalk.cyanBright(message)}`);
}

export function printCommandWarn(message: string) {
  printSection([`${chalk.bold("warning")}  ${message}`], {
    color: chalk.yellow,
    method: "warn",
  });
}

export function printCommandError(message: string, error?: unknown) {
  const detail =
    error instanceof Error ? error.message : error !== undefined ? String(error) : "";
  const lines = [`${chalk.bold("error")}  ${message}`];
  if (detail) {
    lines.push(chalk.redBright(detail));
  }
  printSection(lines, {
    color: chalk.red,
    method: "error",
  });
}

export function printCommandLog(label: string, message: string) {
  const chip = chalk.bgMagenta.white(` ${label} `);
  printLine(`${chip} ${chalk.white(message)}`);
}

export function printCommandSummary(command: string, items: string[]) {
  const normalizedItems = items.map((item) => item.trim()).filter(Boolean);
  if (normalizedItems.length === 0) {
    return;
  }

  const lines = [
    `${chalk.bold(`${command} summary`)}  ${chalk.gray(`(${normalizedItems.length} items)`)}`,
    ...normalizedItems.map((item) => chalk.magenta(`• ${item}`)),
  ];

  printSection(lines, {
    color: chalk.magentaBright,
  });
}
