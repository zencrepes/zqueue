import type { ConfigSearch } from '../config/config.types.js';
import { buildElasticsearchOptions } from './buildElasticsearchOptions.js';

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
  },
};

describe('buildElasticsearchOptions', () => {
  it('builds a plain node connection', () => {
    expect(buildElasticsearchOptions(baseConfig)).toEqual({
      node: 'http://127.0.0.1:9200',
    });
  });

  it('adds basic authentication when credentials are set', () => {
    const options = buildElasticsearchOptions({
      ...baseConfig,
      username: 'zqueue',
      password: 's3cret',
    });
    expect(options).toEqual({
      node: 'http://127.0.0.1:9200',
      auth: { username: 'zqueue', password: 's3cret' },
    });
  });

  it('builds an Elastic Cloud connection when cloudId is set', () => {
    const options = buildElasticsearchOptions({
      ...baseConfig,
      cloudId: 'deployment:abcdef',
      username: 'elastic',
      password: 's3cret',
    });
    expect(options).toEqual({
      cloud: { id: 'deployment:abcdef' },
      auth: { username: 'elastic', password: 's3cret' },
    });
  });

  it('passes a CA certificate through the tls options', () => {
    const ca = Buffer.from('CERTIFICATE');
    const options = buildElasticsearchOptions(baseConfig, ca);
    expect(options.tls).toEqual({ ca, rejectUnauthorized: true });
  });

  it('can disable certificate verification', () => {
    const options = buildElasticsearchOptions({
      ...baseConfig,
      sslVerify: false,
    });
    expect(options.tls).toEqual({ rejectUnauthorized: false });
  });
});
