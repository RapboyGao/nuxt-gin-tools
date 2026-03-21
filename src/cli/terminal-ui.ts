import chalk from "chalk";

type PrintMethod = "log" | "warn" | "error";

const MIN_WIDTH = 60;
const DEFAULT_WIDTH = 96;
const INDENT = "  ";

function printLine(message = "", method: PrintMethod = "log") {
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

function getTerminalWidth(): number {
  const detected = typeof process.stdout.columns === "number" ? process.stdout.columns : 0;
  return Math.max(MIN_WIDTH, detected || DEFAULT_WIDTH);
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

function wrapText(value: string, width: number): string[] {
  const normalized = value.replace(/\r/g, "");
  const rawLines = normalized.split("\n");
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trimEnd();
    if (!line) {
      wrapped.push("");
      continue;
    }

    let current = "";
    for (const word of line.split(/\s+/)) {
      if (!word) {
        continue;
      }

      if (!current) {
        if (stripAnsi(word).length <= width) {
          current = word;
          continue;
        }

        let remainder = word;
        while (stripAnsi(remainder).length > width) {
          wrapped.push(remainder.slice(0, width));
          remainder = remainder.slice(width);
        }
        current = remainder;
        continue;
      }

      const candidate = `${current} ${word}`;
      if (stripAnsi(candidate).length <= width) {
        current = candidate;
        continue;
      }

      wrapped.push(current);
      if (stripAnsi(word).length <= width) {
        current = word;
        continue;
      }

      let remainder = word;
      while (stripAnsi(remainder).length > width) {
        wrapped.push(remainder.slice(0, width));
        remainder = remainder.slice(width);
      }
      current = remainder;
    }

    if (current) {
      wrapped.push(current);
    }
  }

  return wrapped;
}

function printWrapped(
  prefix: string,
  message: string,
  options: { method?: PrintMethod; continuationPrefix?: string } = {},
) {
  const method = options.method ?? "log";
  const width = getTerminalWidth();
  const visiblePrefix = stripAnsi(prefix).length;
  const visibleContinuationPrefix = stripAnsi(options.continuationPrefix ?? prefix).length;
  const firstWidth = Math.max(12, width - visiblePrefix);
  const continuationWidth = Math.max(12, width - visibleContinuationPrefix);
  const lines = wrapText(message, firstWidth);

  if (lines.length === 0) {
    printLine(prefix.trimEnd(), method);
    return;
  }

  printLine(`${prefix}${lines[0]}`, method);
  for (const line of lines.slice(1)) {
    printLine(`${options.continuationPrefix ?? " ".repeat(visiblePrefix)}${line}`, method);
  }
}

function divider(color: (value: string) => string): string {
  const width = Math.max(20, getTerminalWidth() - 2);
  return color(`┄`.repeat(width));
}

function formatClock(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function commandChip(command: string): string {
  return chalk.bold.blueBright(`[${command.toUpperCase()}]`);
}

function timeChip(text: string): string {
  return chalk.gray(`[${text}]`);
}

function printBlock(
  title: string,
  subtitle: string,
  color: (value: string) => string,
  method: PrintMethod = "log",
) {
  const top = color(`┌ ${title}`);
  const bodyPrefix = color("│ ");
  const bottom = color("└");

  printLine("", method);
  printLine(top, method);
  printWrapped(bodyPrefix, subtitle, {
    method,
    continuationPrefix: color("│ "),
  });
  printLine(bottom, method);
}

export function printCommandBanner(command: string, subtitle: string) {
  const title = `${chalk.bold("nuxt-gin-tools")} ${commandChip(command)} ${timeChip(formatClock())}`;
  printBlock(title, chalk.cyanBright(subtitle), chalk.blueBright);
}

export function printCommandSuccess(command: string, message: string) {
  const prefix = `${chalk.greenBright("◆")} ${chalk.bold.green(command)} `;
  const continuationPrefix = `${" ".repeat(stripAnsi(prefix).length)}${INDENT}`;
  printWrapped(prefix, chalk.green(message), {
    continuationPrefix,
  });
}

export function printCommandInfo(label: string, message: string) {
  const prefix = `${chalk.bold.cyan(`[${label.toUpperCase()}]`)} `;
  const continuationPrefix = `${" ".repeat(stripAnsi(prefix).length)}${INDENT}`;
  printWrapped(prefix, chalk.cyanBright(message), {
    continuationPrefix,
  });
}

export function printCommandWarn(message: string) {
  printBlock(chalk.bold.yellow("warning"), chalk.yellow(message), chalk.yellow, "warn");
}

export function printCommandError(message: string, error?: unknown) {
  const detail =
    error instanceof Error ? error.message : error !== undefined ? String(error) : "";

  printBlock(chalk.bold.red("error"), chalk.redBright(message), chalk.red, "error");
  if (detail) {
    const prefix = `${chalk.red("│")} `;
    printWrapped(prefix, chalk.red(detail), {
      method: "error",
      continuationPrefix: prefix,
    });
    printLine(chalk.red("└"), "error");
  }
}

export function printCommandLog(label: string, message: string) {
  const prefix = `${chalk.bold.magenta(`[${label}]`)} `;
  const continuationPrefix = `${" ".repeat(stripAnsi(prefix).length)}${INDENT}`;
  printWrapped(prefix, chalk.white(message), {
    continuationPrefix,
  });
}

export function printCommandSummary(command: string, items: string[]) {
  const normalizedItems = items.map((item) => item.trim()).filter(Boolean);
  if (normalizedItems.length === 0) {
    return;
  }

  printLine("");
  printLine(divider(chalk.magentaBright));
  printWrapped(
    `${chalk.magentaBright("■")} `,
    chalk.bold.magenta(`${command} summary`) +
      chalk.gray(` (${normalizedItems.length} item${normalizedItems.length > 1 ? "s" : ""})`),
    {
      continuationPrefix: "  ",
    },
  );

  for (const item of normalizedItems) {
    printWrapped(`${chalk.magenta("•")} `, chalk.white(item), {
      continuationPrefix: "  ",
    });
  }

  printLine(divider(chalk.magentaBright));
}
