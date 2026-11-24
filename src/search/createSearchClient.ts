import type { ConfigSearch } from '../config/config.types.js';
import { createElasticsearchClient } from './createElasticsearchClient.js';
import { createOpensearchClient } from './createOpensearchClient.js';
import type { SearchClient } from './searchClient.types.js';

export const createSearchClient = (config: ConfigSearch): SearchClient => {
  switch (config.engine) {
    case 'opensearch':
      return createOpensearchClient(config);
    case 'elasticsearch':
      return createElasticsearchClient(config);
    default:
      throw new Error(
        `Unsupported search engine: ${String(config.engine)} ` +
          '(expected "elasticsearch" or "opensearch")',
      );
  }
};
