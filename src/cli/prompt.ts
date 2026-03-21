import { confirm, select } from "@inquirer/prompts";
import chalk from "chalk";
import { printCommandInfo, printCommandWarn } from "./terminal-ui";

export type SelectPromptOption<T extends string> = {
  label: string;
  value: T;
  hint?: string;
};

export type SelectPromptInput<T extends string> = {
  label: string;
  message: string;
  options: SelectPromptOption<T>[];
  defaultValue: T;
  nonInteractiveMessage?: string;
};

export type ConfirmPromptInput = {
  label: string;
  message: string;
  defaultValue: boolean;
  nonInteractiveMessage?: string;
};

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export async function selectWithDefault<T extends string>(
  input: SelectPromptInput<T>,
): Promise<T> {
  if (!isInteractiveTerminal()) {
    printCommandInfo(
      input.label,
      input.nonInteractiveMessage ??
        `No interactive terminal detected, using default: ${input.defaultValue}`,
    );
    return input.defaultValue;
  }

  const orderedOptions = [
    ...input.options.filter((option) => option.value === input.defaultValue),
    ...input.options.filter((option) => option.value !== input.defaultValue),
  ];
  const promptChoices = orderedOptions.map((option) => ({
    name: option.label,
    value: option.value,
    ...(option.hint ? { description: option.hint } : {}),
  }));

  try {
    return await select<T>({
      message: `${input.message} ${chalk.gray(`(default: ${input.defaultValue})`)}`,
      choices: promptChoices,
      default: input.defaultValue,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      printCommandWarn(`Prompt cancelled, using default: ${input.defaultValue}`);
      return input.defaultValue;
    }
    throw error;
  }
}

export async function confirmWithDefault(input: ConfirmPromptInput): Promise<boolean> {
  if (!isInteractiveTerminal()) {
    printCommandInfo(
      input.label,
      input.nonInteractiveMessage ??
        `No interactive terminal detected, using default: ${input.defaultValue ? "yes" : "no"}`,
    );
    return input.defaultValue;
  }

  try {
    return await confirm({
      message: `${input.message} ${chalk.gray(`(default: ${input.defaultValue ? "yes" : "no"})`)}`,
      default: input.defaultValue,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") {
      printCommandWarn(
        `Prompt cancelled, using default: ${input.defaultValue ? "yes" : "no"}`,
      );
      return input.defaultValue;
    }
    throw error;
  }
}
