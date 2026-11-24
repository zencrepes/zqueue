import type { SearchEngine } from '../config/config.types.js';

export interface IndexDefinition {
  mappings: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface BulkDocument {
  id: string;
  body: Record<string, unknown>;
}

export interface BulkError {
  id: string;
  status: number;
  reason: string;
}

export interface BulkResult {
  indexed: number;
  errors: BulkError[];
}

// The surface zqueue needs from a search engine, implemented by both the
// Elasticsearch and the OpenSearch adapters.
export interface SearchClient {
  engine: SearchEngine;
  description: string;
  checkHealth: () => Promise<{ status: string }>;
  indexExists: (index: string) => Promise<boolean>;
  createIndex: (index: string, definition: IndexDefinition) => Promise<void>;
  bulkIndex: (
    index: string,
    documents: BulkDocument[],
  ) => Promise<BulkResult>;
}
