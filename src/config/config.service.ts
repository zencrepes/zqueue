import path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import type { ZqueueConfig } from './config.types.js';
import { initConfigFile } from './initConfigFile.js';
import { loadUserConfig } from './loadUserConfig.js';
import { resolveConfigDir } from './resolveConfigDir.js';

export interface EnvConf {
  [key: string]: string;
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  private readonly envConfig: EnvConf;
  private userConfig: ZqueueConfig;

  constructor() {
    const configDir = resolveConfigDir();
    this.envConfig = {
      CONFIG_DIR: configDir,
      APP_VERSION: process.env.APP_VERSION ?? 'develop',
    };

    if (initConfigFile(configDir)) {
      this.logger.error(
        'No configuration file was present; a default one was created at: ' +
          path.join(configDir, 'config.yml'),
      );
      this.logger.error(
        'Stopping zqueue: edit the configuration file (secrets, search ' +
          'engine credentials), then start zqueue again',
      );
      process.exit(1);
    }

    this.userConfig = loadUserConfig(configDir);
    this.logger.log(
      'Configuration loaded from: ' + path.join(configDir, 'config.yml'),
    );
    this.logger.log('Started zqueue version: ' + this.envConfig.APP_VERSION);
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getUserConfig(): ZqueueConfig {
    return this.userConfig;
  }

  setUserConfig(userConfig: ZqueueConfig): void {
    this.userConfig = userConfig;
  }
}
