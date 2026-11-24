import type { ConfigSearch } from '../config/config.types.js';
import { buildOpensearchOptions } from './buildOpensearchOptions.js';

const baseConfig: ConfigSearch = {
  engine: 'opensearch',
  host: 'https://127.0.0.1:9200',
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

describe('buildOpensearchOptions', () => {
  it('builds a plain node connection', () => {
    expect(buildOpensearchOptions(baseConfig)).toEqual({
      node: 'https://127.0.0.1:9200',
    });
  });

  it('adds basic authentication when credentials are set', () => {
    const options = buildOpensearchOptions({
      ...baseConfig,
      username: 'admin',
      password: 'myStrongPassword123!',
    });
    expect(options).toEqual({
      node: 'https://127.0.0.1:9200',
      auth: { username: 'admin', password: 'myStrongPassword123!' },
    });
  });

  it('passes a CA certificate through the ssl options', () => {
    const ca = Buffer.from('CERTIFICATE');
    const options = buildOpensearchOptions(baseConfig, ca);
    expect(options.ssl).toEqual({ ca, rejectUnauthorized: true });
  });

  it('can disable certificate verification (self-signed clusters)', () => {
    const options = buildOpensearchOptions({
      ...baseConfig,
      sslVerify: false,
    });
    expect(options.ssl).toEqual({ rejectUnauthorized: false });
  });
});
