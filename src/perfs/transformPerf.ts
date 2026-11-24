import type { BulkDocument } from '../search/searchClient.types.js';
import { getPerfId } from './getPerfId.js';
import type { PerfsPayload } from './perfsPayload.types.js';

const toEdges = <T>(nodes: T[]) => ({
  edges: nodes.map((node) => ({ node })),
  totalCount: nodes.length,
});

// Reshapes a performance payload into the GraphQL-connection shape used
// across ZenCrepes datasets, consistent with the GitHub-sourced documents.
export const transformPerf = (payload: PerfsPayload): BulkDocument => {
  const transactionNames = [
    ...new Set(
      payload.runs.flatMap((run) =>
        Object.values(run.statistics).map((statistic) => statistic.transaction),
      ),
    ),
  ];
  const id = getPerfId(payload);
  return {
    id,
    body: {
      ...payload,
      id,
      verified: false,
      description: payload.description ?? '',
      analysis: '',
      resources: toEdges(
        payload.resources.map((resource) => ({
          ...resource,
          id: getPerfId(resource),
          name_size: `${resource.name}_${resource.size}`,
        })),
      ),
      transactions: toEdges(transactionNames.map((name) => ({ name }))),
      tags: toEdges(payload.tags ?? []),
      runs: toEdges(
        payload.runs.map((run) => ({
          ...run,
          statistics: Object.values(run.statistics),
          id: getPerfId(run),
        })),
      ),
    },
  };
};
