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
  AUTH0_DISABLED: boolean;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;

  private readonly envConfig: EnvConf;
  private userConfig: zencrepesConfig;

  constructor() {
    // Initialize config directory:

    // eslint-disable-next-line
    const untildify = require('untildify');
    const defaultEnv = {
      CONFIG_DIR: '~/.config/zindexer/',
      AUTH0_DISABLED: false,
      AUTH0_DOMAIN: '',
      AUTH0_AUDIENCE: '',
    };

    this.envConfig = {};
    this.envConfig.CONFIG_DIR =
      process.env.CONFIG_PATH === undefined
        ? untildify(defaultEnv.CONFIG_DIR)
        : untildify(process.env.CONFIG_PATH);
    this.envConfig.AUTH0_DISABLED =
      process.env.AUTH0_DISABLED === undefined
        ? defaultEnv.AUTH0_DISABLED
        : JSON.parse(process.env.AUTH0_DISABLED); // Trick to convert string to boolean
    this.envConfig.AUTH0_DOMAIN =
      process.env.AUTH0_DOMAIN === undefined
        ? defaultEnv.AUTH0_DOMAIN
        : process.env.AUTH0_DOMAIN;
    this.envConfig.AUTH0_AUDIENCE =
      process.env.AUTH0_AUDIENCE === undefined
        ? defaultEnv.AUTH0_AUDIENCE
        : process.env.AUTH0_AUDIENCE;

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
