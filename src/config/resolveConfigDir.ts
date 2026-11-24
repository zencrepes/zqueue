import { homedir } from 'node:os';

const expandTilde = (filePath: string): string =>
  filePath.startsWith('~') ? homedir() + filePath.slice(1) : filePath;

export const resolveConfigDir = (
  env: NodeJS.ProcessEnv = process.env,
): string => expandTilde(env.CONFIG_PATH ?? '~/.config/zindexer/');
