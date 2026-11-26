export type SearchEngine = 'elasticsearch' | 'opensearch';

export interface ConfigSearch {
  engine: SearchEngine;
  host: string;
  sslCa: string;
  sslVerify: boolean;
  cloudId: string;
  username: string;
  password: string;
  dataIndices: {
    testingStates: string;
    testingRuns: string;
    testingCases: string;
    testingPerfs: string;
    runnerUsage: string;
  };
}

export interface ConfigRedis {
  host: string;
}

export interface ConfigGithubWebhook {
  secret: string;
  includeGithubEvents: string[];
  excludeGithubEvents: string[];
  esIndexPrefix: string;
}

export interface ConfigGithub {
  webhook: ConfigGithubWebhook;
}

export interface ConfigTesting {
  webhook: {
    secret: string;
  };
}

export interface ConfigRunners {
  webhook: {
    secret: string;
  };
}

export interface ZqueueConfig {
  elasticsearch: ConfigSearch;
  redis: ConfigRedis;
  github: ConfigGithub;
  testing: ConfigTesting;
  runners: ConfigRunners;
}
