# Runner usage reports

A CI runner can tell zqueue how much of its capacity one job used. zqueue stores one document per job. You can then
ask which jobs ran on a runner that was too big, or too small, for them.

This page is the contract between the sender (the runner) and the readers of the index. A field changes only with a
new `schemaVersion`.

## The endpoint

`POST /runners/webhook`

| Item | Value |
|---|---|
| Signature | `x-hub-signature-256`: `sha256=` followed by the HMAC SHA-256 of the raw body, computed with `runners.webhook.secret`. The legacy `x-hub-signature` (sha1) header also works. |
| Success | `202` with `{ "success": true }`. The report is queued, not yet stored. |
| Wrong or missing signature | `401`. This is checked first, so a caller without the secret learns nothing about the schema. |
| Report that breaks the schema | `400`. The message names the first field that is wrong, for example `usage.cpu.p95Pct: expected a number between 0 and 100`. The limits in the table below follow the types of the index, so a report that passes this check should not be refused by the index later. |
| Secret not set | `401` for every report. `runners.webhook.secret` is empty by default. |

The secret has its own key. The runners hold it, so it is not the secret that signs test results.

Send a report like this. The secret comes from the environment and is never printed:

```bash
BODY=$(cat report.json)
SIGNATURE="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$RUNNERS_WEBHOOK_SECRET" | sed 's/^.* //')"
curl -sS -X POST "$ZQUEUE_URL/runners/webhook" \
  -H 'content-type: application/json' \
  -H "x-hub-signature-256: $SIGNATURE" \
  --data-binary "$BODY"
```

The signature covers the exact bytes of the body. Do not reformat the JSON between signing and sending.

## The report

All values below are made up.

```json
{
  "schemaVersion": 1,
  "runnerType": "aws-spot",
  "runnerName": "default_i-0123456789abcdef0",
  "instance": { "id": "i-0123456789abcdef0", "type": "t3a.2xlarge" },
  "github": {
    "repository": "Org/repo",
    "runId": 1234567890,
    "runAttempt": 1,
    "workflow": "Workflow display name",
    "job": "job-key-in-the-yaml"
  },
  "startedAt": "2026-11-26T10:00:00.000Z",
  "endedAt": "2026-11-26T10:12:30.000Z",
  "provisioned": { "vcpu": 8, "memoryMb": 32768, "diskGb": 55 },
  "usage": {
    "cpu": { "meanPct": 21.4, "p95Pct": 64.0, "peakPct": 97.2 },
    "memory": { "meanMb": 5120, "peakMb": 9800, "peakPct": 29.9 },
    "disk": { "startUsedGb": 12.1, "endUsedGb": 31.4, "peakUsedGb": 31.4, "peakPct": 57.1 }
  },
  "sampling": { "intervalSeconds": 5, "samples": 150, "truncated": false }
}
```

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | Must be `1`. |
| `runnerType` | string | Not empty. `aws-spot` today. Another kind of runner needs no schema change. |
| `runnerName` | string | Not empty. It must equal `workflow_job.runner_name` of the same job. See "Joining a report to its job". |
| `instance.id`, `instance.type` | string | Not empty. The EC2 instance id and type, from the instance metadata. |
| `github.repository` | string | `owner/name`: one slash, no space. |
| `github.runId` | integer | 1 to 9007199254740991. A numeric string is accepted and stored as a number. Shell scripts send strings. |
| `github.runAttempt` | integer | 1 to 2147483647. A numeric string is accepted too. |
| `github.workflow`, `github.job` | string | Not empty. `job` is `GITHUB_JOB`, the key of the job in the workflow file. It is not the numeric job id. |
| `startedAt`, `endedAt` | ISO 8601 date | A date, a time and a timezone, for example `2026-11-26T10:00:00.000Z` or `2026-11-26T12:00:00+02:00`. Fractions of a second are optional. A date such as `2026-02-31T10:00:00Z`, `Nov 26 2026` or `2026-11-26T10:00:00` (no timezone) is refused. `endedAt` is not before `startedAt`. |
| `provisioned.vcpu`, `.memoryMb`, `.diskGb` | number | Greater than 0 and at most 1e12. Read from the machine at the start of the job, not copied from a configuration. |
| `usage.cpu.meanPct`, `.p95Pct`, `.peakPct` | number | 0 to 100. |
| `usage.memory.meanMb`, `.peakMb` | number | 0 to 1e12. |
| `usage.memory.peakPct`, `usage.disk.peakPct` | number | 0 to 100. |
| `usage.disk.startUsedGb`, `.endUsedGb`, `.peakUsedGb` | number | 0 to 1e12. |
| `sampling.intervalSeconds`, `.samples` | integer | 0 to 2147483647. `samples` is 0 when nothing was sampled. |
| `sampling.truncated` | boolean | `true` when sampling stopped before the job ended. Readers should leave such a report out of any ranking. |

A field that is not in this table is dropped. zqueue adds three fields of its own to the stored document:

| Field | Meaning |
|---|---|
| `id` | The document id. It is built from `runnerName`, `runId`, `runAttempt` and `github.job`. The same report sent twice replaces the stored document, so a retry never creates a duplicate. Two jobs of one run that report under the same runner name keep two documents. |
| `receivedAt` | When zqueue received the report. |
| `flavour` | The runner flavour, read from the runner name when it looks like `<flavour>_i-<hex id>`, for example `default` for `default_i-097488b4382d33a10`. It is `null` for any other name. |

## Where it is stored

The index is `elasticsearch.dataIndices.runnerUsage`, `runner_usage_` by default. zqueue creates it on the first
report. In OpenSearch Dashboards, use the index pattern `runner_usage_*` and the time field `endedAt`.

The least-privilege role of [setup.md](setup.md) must allow the pattern `runner_usage_*`. Without it, the first report
fails when zqueue creates the index.

Identifiers (`runnerName`, `flavour`, `github.*`, `instance.*`) are `keyword` fields, so you can group and filter on
them exactly.

## Joining a report to its job

A report has no job link and no job name. zqueue already records the `workflow_job` events of GitHub, and the join to
them happens when you query. Neither record waits for the other, so they may arrive in any order.

The join key is `runnerName` in `runner_usage_`, and `payload.workflow_job.runner_name` in `gh_events_workflow_job`. A
runner is ephemeral and runs one job, so the name identifies one job.

The runner name has a different shape on each kind of runner:

| Runner | `runner_name` | Flavour |
|---|---|---|
| Self-hosted, current stack | `default_i-097488b4382d33a10` | `default` |
| Self-hosted, previous stack | `i-0df218c11cb2565d0` | none |
| GitHub-hosted | `GitHub Actions 1000870980` | none |
| A job that has not started | `null` | none |

A job with a `null` runner name cannot be joined. Leave it out.

To get the repository, workflow, job name and link of a set of reports:

1. Aggregate `runner_usage_` by `runnerName` (or by `github.repository`, `github.workflow` and `flavour`).
2. Look up those runner names in `gh_events_workflow_job` with the events whose `payload.action` is `completed`. A
   `queued` event has no runner yet.
3. Read `payload.workflow_job.name` (the job name), `payload.workflow_job.html_url` (the link) and
   `payload.workflow_job.labels` from the match.

The labels of a self-hosted job do not always name the flavour. Take the flavour from `flavour`.
