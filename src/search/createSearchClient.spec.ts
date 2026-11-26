import type { ConfigSearch } from '../config/config.types.js';
import { createSearchClient } from './createSearchClient.js';

const baseConfig: ConfigSearch = {
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
    runnerUsage: 'runner_usage_',
  },
};

describe('createSearchClient', () => {
  it('creates an Elasticsearch adapter', () => {
    const client = createSearchClient(baseConfig);
    expect(client.engine).toBe('elasticsearch');
  });

  it('creates an OpenSearch adapter', () => {
    const client = createSearchClient({ ...baseConfig, engine: 'opensearch' });
    expect(client.engine).toBe('opensearch');
  });

  it('refuses an unknown engine', () => {
    expect(() =>
      createSearchClient({
        ...baseConfig,
        engine: 'solr' as ConfigSearch['engine'],
      }),
    ).toThrow('Unsupported search engine: solr');
  });
});
