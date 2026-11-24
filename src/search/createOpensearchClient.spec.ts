import type { ConfigSearch } from '../config/config.types.js';
import type { RawOpensearchClient } from './createOpensearchClient.js';
import { createOpensearchClient } from './createOpensearchClient.js';

const config: ConfigSearch = {
  engine: 'opensearch',
  host: 'https://127.0.0.1:9200',
  sslCa: '',
  sslVerify: false,
  cloudId: '',
  username: 'admin',
  password: 'myStrongPassword123!',
  dataIndices: {
    testingStates: 't_states_',
    testingRuns: 't_runs_',
    testingCases: 't_cases_',
    testingPerfs: 't_perfs_',
  },
};

const buildRawClient = (): RawOpensearchClient & {
  calls: Record<string, unknown[]>;
} => {
  const calls: Record<string, unknown[]> = { exists: [], create: [], bulk: [] };
  return {
    calls,
    cluster: {
      health: async () => ({ body: { status: 'yellow' } }),
    },
    indices: {
      exists: async (params: { index: string }) => {
        calls.exists.push(params);
        return { body: true };
      },
      create: async (params: unknown) => {
        calls.create.push(params);
        return {};
      },
    },
    bulk: async (params: { body: unknown[] }) => {
      calls.bulk.push(params);
      return {
        body: {
          errors: true,
          items: [
            { index: { _id: 'doc-1', status: 201 } },
            {
              index: {
                _id: 'doc-2',
                status: 400,
                error: { type: 'mapper_parsing_exception', reason: 'boom' },
              },
            },
          ],
        },
      };
    },
  };
};

describe('createOpensearchClient', () => {
  it('exposes the engine and an authenticated description', () => {
    const client = createOpensearchClient(config, buildRawClient());
    expect(client.engine).toBe('opensearch');
    expect(client.description).toContain('OpenSearch');
    expect(client.description).toContain('authenticated as admin');
    expect(client.description).not.toContain('myStrongPassword123!');
  });

  it('unwraps the body of the health response', async () => {
    const client = createOpensearchClient(config, buildRawClient());
    expect(await client.checkHealth()).toEqual({ status: 'yellow' });
  });

  it('unwraps the body of the exists response', async () => {
    const client = createOpensearchClient(config, buildRawClient());
    expect(await client.indexExists('idx')).toBe(true);
  });

  it('creates an index with the body-wrapped definition', async () => {
    const raw = buildRawClient();
    const client = createOpensearchClient(config, raw);
    await client.createIndex('idx', {
      mappings: { properties: {} },
      settings: { number_of_shards: 1 },
    });
    expect(raw.calls.create).toEqual([
      {
        index: 'idx',
        body: {
          mappings: { properties: {} },
          settings: { number_of_shards: 1 },
        },
      },
    ]);
  });

  it('bulk-indexes documents and surfaces per-item errors', async () => {
    const raw = buildRawClient();
    const client = createOpensearchClient(config, raw);
    const result = await client.bulkIndex('idx', [
      { id: 'doc-1', body: { a: 1 } },
      { id: 'doc-2', body: { b: 2 } },
    ]);
    expect(raw.calls.bulk).toEqual([
      {
        body: [
          { index: { _index: 'idx', _id: 'doc-1' } },
          { a: 1 },
          { index: { _index: 'idx', _id: 'doc-2' } },
          { b: 2 },
        ],
      },
    ]);
    expect(result).toEqual({
      indexed: 1,
      errors: [{ id: 'doc-2', status: 400, reason: 'boom' }],
    });
  });
});
