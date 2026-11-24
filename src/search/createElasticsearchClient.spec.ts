import type { ConfigSearch } from '../config/config.types.js';
import type { RawElasticsearchClient } from './createElasticsearchClient.js';
import { createElasticsearchClient } from './createElasticsearchClient.js';

const config: ConfigSearch = {
  engine: 'elasticsearch',
  host: 'http://127.0.0.1:9200',
  sslCa: '',
  sslVerify: true,
  cloudId: '',
  username: '',
  password: '',
  dataIndices: {
    testingStates: 't_states_',
    testingRuns: 't_runs_',
    testingCases: 't_cases_',
    testingPerfs: 't_perfs_',
  },
};

const buildRawClient = (): RawElasticsearchClient & {
  calls: Record<string, unknown[]>;
} => {
  const calls: Record<string, unknown[]> = {
    health: [],
    exists: [],
    create: [],
    bulk: [],
  };
  return {
    calls,
    cluster: {
      health: async () => {
        calls.health.push({});
        return { status: 'green' };
      },
    },
    indices: {
      exists: async (params: { index: string }) => {
        calls.exists.push(params);
        return false;
      },
      create: async (params: unknown) => {
        calls.create.push(params);
        return {};
      },
    },
    bulk: async (params: { operations: unknown[] }) => {
      calls.bulk.push(params);
      return {
        errors: false,
        items: [{ index: { _id: 'doc-1', status: 201 } }],
      };
    },
  };
};

describe('createElasticsearchClient', () => {
  it('exposes the engine and a connection description', () => {
    const client = createElasticsearchClient(config, buildRawClient());
    expect(client.engine).toBe('elasticsearch');
    expect(client.description).toContain('http://127.0.0.1:9200');
  });

  it('returns the cluster status directly', async () => {
    const client = createElasticsearchClient(config, buildRawClient());
    expect(await client.checkHealth()).toEqual({ status: 'green' });
  });

  it('checks index existence', async () => {
    const raw = buildRawClient();
    const client = createElasticsearchClient(config, raw);
    expect(await client.indexExists('idx')).toBe(false);
    expect(raw.calls.exists).toEqual([{ index: 'idx' }]);
  });

  it('creates an index with flattened mappings and settings', async () => {
    const raw = buildRawClient();
    const client = createElasticsearchClient(config, raw);
    await client.createIndex('idx', {
      mappings: { properties: {} },
      settings: { number_of_shards: 1 },
    });
    expect(raw.calls.create).toEqual([
      {
        index: 'idx',
        mappings: { properties: {} },
        settings: { number_of_shards: 1 },
      },
    ]);
  });

  it('bulk-indexes documents as operation pairs', async () => {
    const raw = buildRawClient();
    const client = createElasticsearchClient(config, raw);
    const result = await client.bulkIndex('idx', [
      { id: 'doc-1', body: { hello: 'world' } },
    ]);
    expect(raw.calls.bulk).toEqual([
      {
        operations: [
          { index: { _index: 'idx', _id: 'doc-1' } },
          { hello: 'world' },
        ],
      },
    ]);
    expect(result).toEqual({ indexed: 1, errors: [] });
  });
});
