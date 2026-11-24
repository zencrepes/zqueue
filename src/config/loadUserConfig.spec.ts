import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadUserConfig } from './loadUserConfig.js';

describe('loadUserConfig', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zqueue-config-'));
  });

  afterEach(() => {
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  it('merges a legacy config file with the new defaults', () => {
    // A v1-era file: no engine, no sslVerify, no github.webhook new keys.
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      [
        'elasticsearch:',
        '  host: http://search.example.com:9200',
        'github:',
        '  webhook:',
        '    secret: shhh',
        'redis:',
        '  host: redis://queue.example.com:6379',
      ].join('\n'),
    );
    const config = loadUserConfig(configDir);
    expect(config.elasticsearch.host).toBe('http://search.example.com:9200');
    expect(config.elasticsearch.engine).toBe('elasticsearch');
    expect(config.elasticsearch.sslVerify).toBe(true);
    expect(config.github.webhook.secret).toBe('shhh');
    expect(config.github.webhook.includeGithubEvents).toEqual(['*']);
    expect(config.github.webhook.esIndexPrefix).toBe('gh_events_');
    expect(config.redis.host).toBe('redis://queue.example.com:6379');
  });

  it('honours an opensearch configuration with authentication', () => {
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      [
        'elasticsearch:',
        '  engine: opensearch',
        '  host: https://opensearch.example.com:9200',
        '  username: zqueue',
        '  password: s3cret',
        '  sslVerify: false',
      ].join('\n'),
    );
    const config = loadUserConfig(configDir);
    expect(config.elasticsearch.engine).toBe('opensearch');
    expect(config.elasticsearch.username).toBe('zqueue');
    expect(config.elasticsearch.password).toBe('s3cret');
    expect(config.elasticsearch.sslVerify).toBe(false);
  });
});
