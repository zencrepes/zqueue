import { bulkIndexDocuments } from './bulkIndexDocuments.js';
import { ensureIndex } from './ensureIndex.js';
import { formatBulkErrors } from './formatBulkErrors.js';
import type {
  BulkDocument,
  BulkResult,
  IndexDefinition,
  SearchClient,
} from './searchClient.types.js';

export interface RecordLogger {
  log: (message: string) => void;
  error: (message: string) => void;
}

// The single write path of the processors: makes sure the index exists, then
// indexes the documents. A bulk item failure throws, which hands the job back
// to BullMQ for a retry (document ids make retries idempotent).
export const recordDocuments = async (
  client: SearchClient,
  index: string,
  definition: IndexDefinition,
  documents: BulkDocument[],
  ensured: Set<string>,
  logger: RecordLogger,
): Promise<BulkResult> => {
  const created = await ensureIndex(client, index, definition, ensured);
  if (created) {
    logger.log(`Created index: ${index}`);
  }
  const result = await bulkIndexDocuments(client, index, documents);
  if (result.errors.length > 0) {
    const reasons = formatBulkErrors(result.errors);
    logger.error(
      `Failed to record ${result.errors.length} document(s) into ${index}: ${reasons}`,
    );
    throw new Error(`Bulk indexing into ${index} failed: ${reasons}`);
  }
  return result;
};
