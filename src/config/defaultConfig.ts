import type { ZqueueConfig } from './config.types.js';

// The configuration file is shared with zindexer (~/.config/zindexer/config.yml),
// which owns additional sections (jira, circleci, ...) that zqueue ignores.
export const defaultConfig: ZqueueConfig = {
  elasticsearch: {
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
  },
  redis: {
    host: 'redis://localhost:6379',
  },
  github: {
    webhook: {
      secret: 'PLEASE_CHANGE_ME',
      includeGithubEvents: ['*'],
      excludeGithubEvents: [],
      esIndexPrefix: 'gh_events_',
    },
  },
  testing: {
    webhook: {
      secret: 'PLEASE_CHANGE_ME',
    },
  },
};
