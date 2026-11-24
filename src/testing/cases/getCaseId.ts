import { uuidV5FromParts } from '../../shared/uuidV5FromParts.js';

// A case id must be unique per execution, so it derives from the case id and
// its creation date (every case run is recorded).
export const getCaseId = (testCase: {
  id: string;
  createdAt: string;
}): string => uuidV5FromParts(testCase.id, testCase.createdAt);
