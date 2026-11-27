import { v5 as uuidv5 } from 'uuid';

import { UUID_NAMESPACE } from '../shared/uuidV5FromParts.js';

// The same report posted twice must replace the stored document, and two
// different reports must never share an id. A runner is ephemeral and runs one
// job, so its name is unique per job; the run id, the attempt and the job key
// are added so that a reused runner cannot overwrite the report of another job.
//
// uuidV5FromParts is not used here: it strips every non-alphanumeric character
// and joins the parts with nothing, so run 1 attempt 23 and run 12 attempt 3
// would give the same id. A JSON array keeps the parts apart and the case.
export const getRunnerUsageId = (node: {
  runnerName: string;
  runId: number;
  runAttempt: number;
  job: string;
}): string =>
  uuidv5(
    JSON.stringify([node.runnerName, node.runId, node.runAttempt, node.job]),
    UUID_NAMESPACE,
  );
