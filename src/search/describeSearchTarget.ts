import type { ConfigSearch } from '../config/config.types.js';

// A log-friendly description of the connection target, without credentials.
export const describeSearchTarget = (config: ConfigSearch): string => {
  const auth =
    config.username !== '' && config.password !== ''
      ? ` (authenticated as ${config.username})`
      : ' (no authentication)';
  if (config.engine === 'elasticsearch' && config.cloudId !== '') {
    return (
      'Elasticsearch client initialized with Elastic Cloud ID: ' +
      config.cloudId.slice(0, 5) +
      '...' +
      auth
    );
  }
  const engineName =
    config.engine === 'opensearch' ? 'OpenSearch' : 'Elasticsearch';
  return `${engineName} client initialized with host: ${config.host}${auth}`;
};
