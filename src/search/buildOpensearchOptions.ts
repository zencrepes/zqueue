import type { ClientOptions } from '@opensearch-project/opensearch';

import type { ConfigSearch } from '../config/config.types.js';

export const buildOpensearchOptions = (
  config: ConfigSearch,
  ca?: Buffer,
): ClientOptions => {
  const auth =
    config.username !== '' && config.password !== ''
      ? { auth: { username: config.username, password: config.password } }
      : {};
  const ssl =
    ca !== undefined || !config.sslVerify
      ? {
          ssl: {
            ...(ca !== undefined && { ca }),
            rejectUnauthorized: config.sslVerify,
          },
        }
      : {};
  return { node: config.host, ...auth, ...ssl };
};
