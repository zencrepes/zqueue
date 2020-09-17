import { Logger } from '@nestjs/common';

import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as jsYaml from 'js-yaml';
import * as loadYamlFile from 'load-yaml-file';
import * as path from 'path';

import { zencrepesConfig, defaultConfig } from '@bit/zencrepes.zindexer.config';

export interface EnvConf {
  [key: string]: string;
}

export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  CONFIG_PATH: string;
  APP_VERSION: string;

  private readonly envConfig: EnvConf;
  private userConfig: zencrepesConfig;

  constructor() {
    // Initialize config directory:

    // eslint-disable-next-line
    const untildify = require('untildify');
    const defaultEnv = {
      CONFIG_DIR: '~/.config/zindexer/',
      APP_VERSION: 'develop',
    };

    this.envConfig = {};
    this.envConfig.CONFIG_DIR =
      process.env.CONFIG_PATH === undefined
        ? untildify(defaultEnv.CONFIG_DIR)
        : untildify(process.env.CONFIG_PATH);
    this.envConfig.APP_VERSION =
      process.env.APP_VERSION === undefined
        ? defaultEnv.APP_VERSION
        : process.env.APP_VERSION;

    // Look for configuration file or initialize if it couldn't find any
    fse.ensureDirSync(this.envConfig.CONFIG_DIR);
    fse.ensureDirSync(this.envConfig.CONFIG_DIR + '/cache/');

    if (!fs.existsSync(path.join(this.envConfig.CONFIG_DIR, 'config.yml'))) {
      fs.writeFileSync(
        path.join(this.envConfig.CONFIG_DIR, 'config.yml'),
        jsYaml.safeDump(defaultConfig),
      );
      this.logger.error(
        'Initialized configuration file with defaults in: ' +
          path.join(this.envConfig.CONFIG_DIR, 'config.yml'),
      );
      this.logger.error('Please EDIT the configuration file first');
      return process.exit(1);
    } else {
      this.logger.log(
        'Configuration file exists: ' +
          path.join(this.envConfig.CONFIG_DIR, 'config.yml'),
      );

      const userConfig = loadYamlFile.sync(
        path.join(this.envConfig.CONFIG_DIR, 'config.yml'),
      );
      this.setUserConfig(userConfig);
    }
    this.logger.log('Started zqueue version: ' + this.envConfig.APP_VERSION);
  }

  get(key: string): string {
    return this.envConfig[key];
  }

  getUserConfig(): zencrepesConfig {
    return this.userConfig;
  }

  setUserConfig(userConfig: zencrepesConfig) {
    this.userConfig = userConfig;
  }
}
