import type { BulkDocument } from '../search/searchClient.types.js';

// Job pushed to the github queue: the target index and the document to record.
export interface GithubEventJob {
  index: string;
  document: BulkDocument;
}
