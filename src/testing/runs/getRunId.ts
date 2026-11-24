import { uuidV5FromParts } from '../../shared/uuidV5FromParts.js';

// A run id must be unique per execution, so it derives from the payload id
// and the creation date (every run is recorded, nothing is overwritten).
export const getRunId = (run: { id: string; createdAt: string }): string =>
  uuidV5FromParts(run.id, run.createdAt);
