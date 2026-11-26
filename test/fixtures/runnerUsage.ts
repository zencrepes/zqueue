import type { RunnerUsagePayload } from '../../src/runners/runnerUsage.types.js';

// A synthetic report: every value is made up. It is the example of
// docs/runner-usage.md, so the docs and the tests cannot drift apart.
export const validRunnerUsage: RunnerUsagePayload = {
  schemaVersion: 1,
  runnerType: 'aws-spot',
  runnerName: 'default_i-0123456789abcdef0',
  instance: { id: 'i-0123456789abcdef0', type: 't3a.2xlarge' },
  github: {
    repository: 'Org/repo',
    runId: 1234567890,
    runAttempt: 1,
    workflow: 'Workflow display name',
    job: 'job-key-in-the-yaml',
  },
  startedAt: '2026-11-26T10:00:00.000Z',
  endedAt: '2026-11-26T10:12:30.000Z',
  provisioned: { vcpu: 8, memoryMb: 32768, diskGb: 55 },
  usage: {
    cpu: { meanPct: 21.4, p95Pct: 64.0, peakPct: 97.2 },
    memory: { meanMb: 5120, peakMb: 9800, peakPct: 29.9 },
    disk: {
      startUsedGb: 12.1,
      endUsedGb: 31.4,
      peakUsedGb: 31.4,
      peakPct: 57.1,
    },
  },
  sampling: { intervalSeconds: 5, samples: 150, truncated: false },
};
