import { getPerfId } from './getPerfId.js';
import type { PerfsPayload } from './perfsPayload.types.js';
import { transformPerf } from './transformPerf.js';

const statistics = {
  tx1: {
    transaction: 'login',
    sampleCount: 10,
    errorCount: 0,
    errorPct: 0,
    meanResTime: 100,
    medianResTime: 90,
    minResTime: 50,
    maxResTime: 200,
    pct1ResTime: 150,
    pct2ResTime: 180,
    pct3ResTime: 190,
    throughput: 5,
    receivedKBytesPerSec: 10,
    sentKBytesPerSec: 2,
  },
  tx2: {
    transaction: 'browse',
    sampleCount: 10,
    errorCount: 1,
    errorPct: 10,
    meanResTime: 100,
    medianResTime: 90,
    minResTime: 50,
    maxResTime: 200,
    pct1ResTime: 150,
    pct2ResTime: 180,
    pct3ResTime: 190,
    throughput: 5,
    receivedKBytesPerSec: 10,
    sentKBytesPerSec: 2,
  },
};

const payload: PerfsPayload = {
  name: 'nightly-perf',
  rampUp: 60,
  repository: { name: 'perf-repo', url: 'https://github.com/org/perf-repo' },
  startedAt: '2026-11-24T02:00:00.000Z',
  duration: 3600,
  platform: { vendor: 'AWS', tenant: 'tenant-1', region: 'us-east-2' },
  resources: [
    { name: 'elasticsearch', size: 't2.large', image: 'es:7' },
    { name: 'app', size: 't2.xlarge', image: 'app:1' },
  ],
  runs: [
    { name: '100users', rampUp: 60, userCount: 100, statistics },
    { name: '200users', rampUp: 60, userCount: 200, statistics },
  ],
  url: 'https://ci.example.com/perf/1',
};

describe('transformPerf', () => {
  it('derives the document id from name, start date and region', () => {
    const document = transformPerf(payload);
    expect(document.id).toBe(getPerfId(payload));
    expect(document.body.id).toBe(document.id);
  });

  it('wraps resources, runs and tags in the edges shape', () => {
    const { body } = transformPerf(payload) as {
      body: Record<string, { edges: unknown[]; totalCount: number }>;
    };
    expect(body.resources.totalCount).toBe(2);
    expect(body.runs.totalCount).toBe(2);
    expect(body.tags).toEqual({ edges: [], totalCount: 0 });
  });

  it('collects unique transaction names across runs', () => {
    const { body } = transformPerf(payload) as {
      body: {
        transactions: { edges: Array<{ node: { name: string } }> };
      };
    };
    expect(body.transactions.edges.map((edge) => edge.node.name)).toEqual([
      'login',
      'browse',
    ]);
  });

  it('flattens run statistics into an array', () => {
    const { body } = transformPerf(payload) as {
      body: { runs: { edges: Array<{ node: { statistics: unknown[] } }> } };
    };
    expect(body.runs.edges[0].node.statistics).toHaveLength(2);
  });

  it('defaults description and analysis', () => {
    const { body } = transformPerf(payload);
    expect(body.description).toBe('');
    expect(body.analysis).toBe('');
    expect(body.verified).toBe(false);
  });
});
