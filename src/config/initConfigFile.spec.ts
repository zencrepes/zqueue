import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { load } from 'js-yaml';

import { initConfigFile } from './initConfigFile.js';

describe('initConfigFile', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zqueue-config-'));
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('writes a default config file and reports it created one', () => {
    const created = initConfigFile(configDir);
    expect(created).toBe(true);
    const written = load(
      fs.readFileSync(path.join(configDir, 'config.yml'), 'utf8'),
    ) as Record<string, Record<string, unknown>>;
    expect(written.elasticsearch.engine).toBe('elasticsearch');
    expect(written.github).toBeDefined();
  });

  it('creates the directory when missing', () => {
    const nested = path.join(configDir, 'a', 'b');
    expect(initConfigFile(nested)).toBe(true);
    expect(fs.existsSync(path.join(nested, 'config.yml'))).toBe(true);
  });

  it('leaves an existing config file untouched', () => {
    fs.writeFileSync(path.join(configDir, 'config.yml'), 'redis:\n  host: x\n');
    expect(initConfigFile(configDir)).toBe(false);
    expect(fs.readFileSync(path.join(configDir, 'config.yml'), 'utf8')).toBe(
      'redis:\n  host: x\n',
    );
  });
});
