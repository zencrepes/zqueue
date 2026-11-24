import type { BulkDocument } from '../../search/searchClient.types.js';
import { omitKey } from '../../shared/omitKey.js';
import type { TestingPayload } from '../testingPayload.types.js';
import { toDependencyEdges } from '../toDependencyEdges.js';

// The state document keeps one entry per component (same id overwrites).
// Cases are recorded in their own index and excluded here.
export const transformState = (payload: TestingPayload): BulkDocument => {
  return {
    id: payload.id,
    body: {
      ...omitKey(payload, 'cases'),
      full: `${payload.name}_${payload.version}`,
      dependencies: toDependencyEdges(payload.dependencies),
    },
  };
};
