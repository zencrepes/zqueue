import type { BulkDocument } from '../search/searchClient.types.js';
import { getFlavour } from './getFlavour.js';
import { getRunnerUsageId } from './getRunnerUsageId.js';
import type {
  RunnerUsageDocumentBody,
  RunnerUsagePayload,
} from './runnerUsage.types.js';

// The stored document: the validated report as sent, plus the fields that only
// zqueue sets. The date is a parameter so a test can fix it.
export const transformRunnerUsage = (
  payload: RunnerUsagePayload,
  receivedAt: Date = new Date(),
): BulkDocument => {
  const id = getRunnerUsageId({
    runnerName: payload.runnerName,
    runId: payload.github.runId,
    runAttempt: payload.github.runAttempt,
    job: payload.github.job,
  });
  const body: RunnerUsageDocumentBody = {
    ...payload,
    id,
    flavour: getFlavour(payload.runnerName),
    receivedAt: receivedAt.toISOString(),
  };
  return { id, body };
};
