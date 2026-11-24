import fs from 'node:fs';
import path from 'node:path';

import { load } from 'js-yaml';

import type { ZqueueConfig } from './config.types.js';
import { deepMerge } from './deepMerge.js';
import { defaultConfig } from './defaultConfig.js';

// Loads config.yml and fills any key absent from the file (for example the
// settings introduced by newer zqueue versions) with its default value.
export const loadUserConfig = (configDir: string): ZqueueConfig => {
  const configFile = path.join(configDir, 'config.yml');
  const parsed = load(fs.readFileSync(configFile, 'utf8'));
  return deepMerge(defaultConfig, parsed);
};
