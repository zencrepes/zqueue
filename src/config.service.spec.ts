import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as jsYaml from 'js-yaml';
import * as os from 'os';
import * as path from 'path';

import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let configDir: string;
  let exitSpy: jest.SpyInstance;
  const initialEnv = { ...process.env };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zqueue-config-'));
    process.env.CONFIG_PATH = configDir;
    delete process.env.APP_VERSION;
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
    process.env = { ...initialEnv };
  });

  it('initializes a default configuration file and exits when none exists', () => {
    expect(() => new ConfigService()).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(1);
    const configFile = path.join(configDir, 'config.yml');
    expect(fs.existsSync(configFile)).toBe(true);
    const written = jsYaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
    expect(written).toHaveProperty('elasticsearch');
    expect(written).toHaveProperty('github');
  });

  it('loads an existing configuration file', () => {
    const userConfig = {
      elasticsearch: { host: 'http://127.0.0.1:9200' },
      github: { webhook: { secret: 'fake-secret' } },
    };
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      jsYaml.safeDump(userConfig),
    );

    const service = new ConfigService();

    expect(exitSpy).not.toHaveBeenCalled();
    expect(service.getUserConfig()).toEqual(userConfig);
  });

  it('exposes the environment configuration through get()', () => {
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      jsYaml.safeDump({ elasticsearch: {} }),
    );

    const service = new ConfigService();

    expect(service.get('CONFIG_DIR')).toEqual(configDir);
    expect(service.get('APP_VERSION')).toEqual('develop');
  });

  it('reads the application version from the environment', () => {
    process.env.APP_VERSION = '1.2.3';
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      jsYaml.safeDump({ elasticsearch: {} }),
    );

    const service = new ConfigService();

    expect(service.get('APP_VERSION')).toEqual('1.2.3');
  });

  it('allows replacing the user configuration', () => {
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      jsYaml.safeDump({ elasticsearch: {} }),
    );
    const service = new ConfigService();
    const newConfig = { elasticsearch: { host: 'http://other:9200' } } as any;

    service.setUserConfig(newConfig);

    expect(service.getUserConfig()).toEqual(newConfig);
  });
});
