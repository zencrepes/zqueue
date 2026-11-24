import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Logger } from '@nestjs/common';

import { ConfigService } from './config.service.js';

describe('ConfigService', () => {
  let configDir: string;
  const originalConfigPath = process.env.CONFIG_PATH;

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zqueue-config-'));
    process.env.CONFIG_PATH = configDir;
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
    if (originalConfigPath === undefined) {
      delete process.env.CONFIG_PATH;
    } else {
      process.env.CONFIG_PATH = originalConfigPath;
    }
  });

  it('initializes a default config file and exits on first run', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => new ConfigService()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(fs.existsSync(path.join(configDir, 'config.yml'))).toBe(true);
    exitSpy.mockRestore();
  });

  it('loads an existing config file and exposes it', () => {
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      'github:\n  webhook:\n    secret: topsecret\n',
    );
    const service = new ConfigService();
    expect(service.getUserConfig().github.webhook.secret).toBe('topsecret');
    // Defaults are merged in for keys the file does not state.
    expect(service.getUserConfig().elasticsearch.engine).toBe('opensearch');
    expect(service.get('CONFIG_DIR')).toBe(configDir);
    expect(service.get('APP_VERSION')).toBe(
      process.env.APP_VERSION ?? 'develop',
    );
  });

  it('allows replacing the user config (test support)', () => {
    fs.writeFileSync(path.join(configDir, 'config.yml'), 'redis:\n  host: x\n');
    const service = new ConfigService();
    const config = service.getUserConfig();
    service.setUserConfig({
      ...config,
      redis: { host: 'redis://other:6379' },
    });
    expect(service.getUserConfig().redis.host).toBe('redis://other:6379');
  });
});
