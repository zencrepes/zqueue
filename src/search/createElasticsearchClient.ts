import { Client } from '@elastic/elasticsearch';

import type { ConfigSearch } from '../config/config.types.js';
import { buildElasticsearchOptions } from './buildElasticsearchOptions.js';
import { describeSearchTarget } from './describeSearchTarget.js';
import { readCaFile } from './readCaFile.js';
import type { BulkResponseLike } from './summarizeBulkResponse.js';
import { summarizeBulkResponse } from './summarizeBulkResponse.js';
import type { SearchClient } from './searchClient.types.js';

// The Elasticsearch client (v8+) returns response bodies directly.
export interface RawElasticsearchClient {
  cluster: { health: () => Promise<{ status: string }> };
  indices: {
    exists: (params: { index: string }) => Promise<boolean>;
    create: (params: {
      index: string;
      mappings: Record<string, unknown>;
      settings: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  bulk: (params: { operations: unknown[] }) => Promise<BulkResponseLike>;
}

export const createElasticsearchClient = (
  config: ConfigSearch,
  rawClient?: RawElasticsearchClient,
): SearchClient => {
  const client =
    rawClient ??
    (new Client(
      buildElasticsearchOptions(config, readCaFile(config.sslCa)),
    ) as unknown as RawElasticsearchClient);
  return {
    engine: 'elasticsearch',
    description: describeSearchTarget(config),
    checkHealth: async () => ({
      status: (await client.cluster.health()).status,
    }),
    indexExists: (index) => client.indices.exists({ index }),
    createIndex: async (index, definition) => {
      await client.indices.create({
        index,
        mappings: definition.mappings,
        settings: definition.settings,
      });
    },
    bulkIndex: async (index, documents) =>
      summarizeBulkResponse(
        await client.bulk({
          operations: documents.flatMap((document) => [
            { index: { _index: index, _id: document.id } },
            document.body,
          ]),
        }),
      ),
  };
};
