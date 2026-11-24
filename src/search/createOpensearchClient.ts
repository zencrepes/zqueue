import { Client } from '@opensearch-project/opensearch';

import type { ConfigSearch } from '../config/config.types.js';
import { buildOpensearchOptions } from './buildOpensearchOptions.js';
import { describeSearchTarget } from './describeSearchTarget.js';
import { readCaFile } from './readCaFile.js';
import type { BulkResponseLike } from './summarizeBulkResponse.js';
import { summarizeBulkResponse } from './summarizeBulkResponse.js';
import type { SearchClient } from './searchClient.types.js';

// The OpenSearch client wraps every response body in { body }.
export interface RawOpensearchClient {
  cluster: { health: () => Promise<{ body: { status: string } }> };
  indices: {
    exists: (params: { index: string }) => Promise<{ body: boolean }>;
    create: (params: {
      index: string;
      body: {
        mappings: Record<string, unknown>;
        settings: Record<string, unknown>;
      };
    }) => Promise<unknown>;
  };
  bulk: (params: { body: unknown[] }) => Promise<{ body: BulkResponseLike }>;
}

export const createOpensearchClient = (
  config: ConfigSearch,
  rawClient?: RawOpensearchClient,
): SearchClient => {
  const client =
    rawClient ??
    (new Client(
      buildOpensearchOptions(config, readCaFile(config.sslCa)),
    ) as unknown as RawOpensearchClient);
  return {
    engine: 'opensearch',
    description: describeSearchTarget(config),
    checkHealth: async () => ({
      status: (await client.cluster.health()).body.status,
    }),
    indexExists: async (index) => (await client.indices.exists({ index })).body,
    createIndex: async (index, definition) => {
      await client.indices.create({
        index,
        body: {
          mappings: definition.mappings,
          settings: definition.settings,
        },
      });
    },
    bulkIndex: async (index, documents) =>
      summarizeBulkResponse(
        (
          await client.bulk({
            body: documents.flatMap((document) => [
              { index: { _index: index, _id: document.id } },
              document.body,
            ]),
          })
        ).body,
      ),
  };
};
