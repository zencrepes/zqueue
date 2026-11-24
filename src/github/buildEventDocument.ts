import { v4 as uuidv4 } from 'uuid';

import type { BulkDocument } from '../search/searchClient.types.js';

const nestedString = (
  payload: Record<string, unknown>,
  objectKey: string,
  stringKey: string,
): string | null => {
  const nested = payload[objectKey];
  if (typeof nested !== 'object' || nested === null) {
    return null;
  }
  const value = (nested as Record<string, unknown>)[stringKey];
  return typeof value === 'string' ? value : null;
};

// The recorded document: the full payload as received, plus a metadata
// envelope for downstream filtering. The GitHub delivery GUID is used as the
// document id, which makes redeliveries idempotent.
export const buildEventDocument = (
  event: string,
  payload: Record<string, unknown>,
  headers: Record<string, string | undefined>,
  receivedAt: Date,
): BulkDocument => {
  const deliveryId = headers['x-github-delivery'] ?? uuidv4();
  return {
    id: deliveryId,
    body: {
      id: deliveryId,
      event,
      action: typeof payload.action === 'string' ? payload.action : null,
      receivedAt: receivedAt.toISOString(),
      repository: nestedString(payload, 'repository', 'full_name'),
      organization: nestedString(payload, 'organization', 'login'),
      sender: nestedString(payload, 'sender', 'login'),
      delivery: {
        id: deliveryId,
        hookId: headers['x-github-hook-id'] ?? null,
        targetType: headers['x-github-hook-installation-target-type'] ?? null,
        targetId: headers['x-github-hook-installation-target-id'] ?? null,
      },
      payload,
    },
  };
};
