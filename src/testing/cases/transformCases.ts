import type { BulkDocument } from '../../search/searchClient.types.js';
import { getRunId } from '../runs/getRunId.js';
import type { TestingPayload } from '../testingPayload.types.js';
import { toRate } from '../toRate.js';
import { getCaseId } from './getCaseId.js';

// Each case is linked back to its run and enriched with success rates.
export const transformCases = (payload: TestingPayload): BulkDocument[] => {
  const runId = getRunId(payload);
  return (payload.cases ?? []).map((testCase) => {
    const id = getCaseId(testCase);
    return {
      id,
      body: {
        ...testCase,
        id,
        full: `${testCase.suite} - ${testCase.name}`,
        runId,
        url: payload.url,
        project: payload.name,
        caseSuccessRate: toRate(testCase.caseSuccess, testCase.caseTotal),
        caseFailureRate: toRate(testCase.caseFailure, testCase.caseTotal),
      },
    };
  });
};
