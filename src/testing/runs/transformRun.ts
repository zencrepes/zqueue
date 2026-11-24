import type { BulkDocument } from '../../search/searchClient.types.js';
import { omitKey } from '../../shared/omitKey.js';
import type { TestingPayload } from '../testingPayload.types.js';
import { toDependencyEdges } from '../toDependencyEdges.js';
import { toRate } from '../toRate.js';
import { getRunId } from './getRunId.js';

// The run document records every execution (append, never overwrite).
export const transformRun = (payload: TestingPayload): BulkDocument => {
  const id = getRunId(payload);
  return {
    id,
    body: {
      ...omitKey(payload, 'cases'),
      id,
      full: `${payload.name}_${payload.version}`,
      runSuccessRate: toRate(payload.runSuccess, payload.runTotal),
      runFailureRate: toRate(payload.runFailure, payload.runTotal),
      dependencies: toDependencyEdges(payload.dependencies),
    },
  };
};
