import type { BulkResult } from './searchClient.types.js';

interface BulkResponseItem {
  _id?: string;
  status?: number;
  error?: { type?: string; reason?: string };
}

export interface BulkResponseLike {
  errors?: boolean;
  items?: Array<Record<string, BulkResponseItem>>;
}

// Both engines answer a bulk request with the same shape:
// { errors, items: [{ index: { _id, status, error? } }, ...] }
export const summarizeBulkResponse = (
  response: BulkResponseLike,
): BulkResult => {
  const items = response.items ?? [];
  const errors = items
    .map((item) => Object.values(item)[0])
    .filter(
      (item): item is BulkResponseItem =>
        item !== undefined && item.error !== undefined,
    )
    .map((item) => ({
      id: item._id ?? 'unknown',
      status: item.status ?? 0,
      reason: item.error?.reason ?? item.error?.type ?? 'unknown',
    }));
  return { indexed: items.length - errors.length, errors };
};
