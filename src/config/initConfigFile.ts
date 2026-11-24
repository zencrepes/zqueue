import fs from 'node:fs';
import path from 'node:path';

import { dump } from 'js-yaml';

import { defaultConfig } from './defaultConfig.js';

// Returns true when a new configuration file was written (first run).
export const initConfigFile = (configDir: string): boolean => {
  fs.mkdirSync(configDir, { recursive: true });
  const configFile = path.join(configDir, 'config.yml');
  if (fs.existsSync(configFile)) {
    return false;
  }
  fs.writeFileSync(configFile, dump(defaultConfig));
  return true;
};
