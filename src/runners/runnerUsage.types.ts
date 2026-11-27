// The payload sent to /runners/webhook: one usage summary per CI job, built by
// the runner when the job ends. The contract is described in
// docs/runner-usage.md; a field change needs a schemaVersion bump.
// A type alias, not an interface: the stored body must be assignable to the
// Record<string, unknown> of BulkDocument, which an interface is not.
export type RunnerUsagePayload = {
  schemaVersion: 1;
  runnerType: string;
  // Equals workflow_job.runner_name in the gh_events_workflow_job documents.
  runnerName: string;
  instance: { id: string; type: string };
  github: {
    repository: string;
    runId: number;
    runAttempt: number;
    workflow: string;
    // GITHUB_JOB, the key of the job in the workflow file (not the job id).
    job: string;
  };
  startedAt: string;
  endedAt: string;
  provisioned: { vcpu: number; memoryMb: number; diskGb: number };
  usage: {
    cpu: { meanPct: number; p95Pct: number; peakPct: number };
    memory: { meanMb: number; peakMb: number; peakPct: number };
    disk: {
      startUsedGb: number;
      endUsedGb: number;
      peakUsedGb: number;
      peakPct: number;
    };
  };
  sampling: { intervalSeconds: number; samples: number; truncated: boolean };
};

// What is stored: the payload plus the fields that only zqueue sets.
export type RunnerUsageDocumentBody = RunnerUsagePayload & {
  id: string;
  flavour: string | null;
  receivedAt: string;
};
