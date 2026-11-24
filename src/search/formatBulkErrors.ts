import type { BulkError } from './searchClient.types.js';

export const formatBulkErrors = (errors: BulkError[]): string =>
  errors
    .map((error) => `${error.id}: ${error.reason} (${error.status})`)
    .join(', ');
