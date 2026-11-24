import type { ClientOptions } from '@elastic/elasticsearch';

import type { ConfigSearch } from '../config/config.types.js';

export const buildElasticsearchOptions = (
  config: ConfigSearch,
  ca?: Buffer,
): ClientOptions => {
  const auth =
    config.username !== '' && config.password !== ''
      ? { auth: { username: config.username, password: config.password } }
      : {};
  if (config.cloudId !== '') {
    return { cloud: { id: config.cloudId }, ...auth };
  }
  const tls =
    ca !== undefined || !config.sslVerify
      ? {
          tls: {
            ...(ca !== undefined && { ca }),
            rejectUnauthorized: config.sslVerify,
          },
        }
      : {};
  return { node: config.host, ...auth, ...tls };
};
