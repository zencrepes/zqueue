import { chunkArray } from './chunkArray.js';
import type {
  BulkDocument,
  BulkResult,
  SearchClient,
} from './searchClient.types.js';

export const bulkIndexDocuments = async (
  client: SearchClient,
  index: string,
  documents: BulkDocument[],
  chunkSize = 100,
): Promise<BulkResult> => {
  const results: BulkResult[] = [];
  for (const chunk of chunkArray(documents, chunkSize)) {
    results.push(await client.bulkIndex(index, chunk));
  }
  return results.reduce(
    (total, result) => ({
      indexed: total.indexed + result.indexed,
      errors: [...total.errors, ...result.errors],
    }),
    { indexed: 0, errors: [] },
  );
};
