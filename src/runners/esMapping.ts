// Cortex groups by repository, workflow, job and flavour, so every identifier
// is a keyword (an analyzed text field would split them into tokens).
const yaml = `
_source:
  enabled: true
properties:
  id:
    type: keyword
  schemaVersion:
    type: integer
  runnerType:
    type: keyword
  runnerName:
    type: keyword
  flavour:
    type: keyword
  receivedAt:
    type: date
  startedAt:
    type: date
  endedAt:
    type: date
  instance:
    properties:
      id:
        type: keyword
      type:
        type: keyword
  github:
    properties:
      repository:
        type: keyword
      runId:
        type: long
      runAttempt:
        type: integer
      workflow:
        type: keyword
      job:
        type: keyword
  provisioned:
    properties:
      vcpu:
        type: float
      memoryMb:
        type: float
      diskGb:
        type: float
  usage:
    properties:
      cpu:
        properties:
          meanPct:
            type: float
          p95Pct:
            type: float
          peakPct:
            type: float
      memory:
        properties:
          meanMb:
            type: float
          peakMb:
            type: float
          peakPct:
            type: float
      disk:
        properties:
          startUsedGb:
            type: float
          endUsedGb:
            type: float
          peakUsedGb:
            type: float
          peakPct:
            type: float
  sampling:
    properties:
      intervalSeconds:
        type: integer
      samples:
        type: integer
      truncated:
        type: boolean
`;
export default yaml;
