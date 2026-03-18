export type CLIOptions = {
  flags: Set<string>;
  values: Map<string, string>;
  positionals: string[];
};

function normalizeKey(key: string): string {
  return key.replace(/^-+/, "").trim();
}

export function parseCLIOptions(args: string[]): CLIOptions {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const current = args[i]?.trim() ?? "";
    if (!current) continue;
    if (!current.startsWith("-")) {
      positionals.push(current);
      continue;
    }

    const eqIndex = current.indexOf("=");
    if (eqIndex >= 0) {
      values.set(normalizeKey(current.slice(0, eqIndex)), current.slice(eqIndex + 1));
      continue;
    }

    const key = normalizeKey(current);
    const next = args[i + 1]?.trim() ?? "";
    if (next && !next.startsWith("-")) {
      values.set(key, next);
      i += 1;
      continue;
    }
    flags.add(key);
  }

  return { flags, values, positionals };
}

export function hasFlag(options: CLIOptions, key: string): boolean {
  return options.flags.has(normalizeKey(key));
}

export function getOption(options: CLIOptions, key: string): string | undefined {
  return options.values.get(normalizeKey(key));
}
