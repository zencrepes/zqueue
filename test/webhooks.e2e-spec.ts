import { createHmac } from 'node:crypto';

import { getQueueToken } from '@nestjs/bullmq';
import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppController } from '../src/app.controller.js';
import { ConfigService } from '../src/config/config.service.js';
import { GithubController } from '../src/github/github.controller.js';
import { PerfsController } from '../src/perfs/perfs.controller.js';
import { RunnersController } from '../src/runners/runners.controller.js';
import { TestingController } from '../src/testing/testing.controller.js';
import { validRunnerUsage } from './fixtures/runnerUsage.js';

const GITHUB_SECRET = 'e2e-github-secret';
const TESTING_SECRET = 'e2e-testing-secret';

// A made-up secret for this test only.
const RUNNERS_SECRET = 'e2e-runners-test-secret';

const sign256 = (body: string, secret: string) =>
  'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

describe('Webhooks (e2e)', () => {
  let app: INestApplication<App>;
  const githubQueue = { add: vi.fn() };
  const testingQueue = { add: vi.fn() };
  const perfsQueue = { add: vi.fn() };
  const runnersQueue = { add: vi.fn() };

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const moduleFixture = await Test.createTestingModule({
      controllers: [
        AppController,
        GithubController,
        TestingController,
        PerfsController,
        RunnersController,
      ],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: () => 'e2e',
            getUserConfig: () => ({
              github: {
                webhook: {
                  secret: GITHUB_SECRET,
                  includeGithubEvents: ['*'],
                  excludeGithubEvents: ['push'],
                  esIndexPrefix: 'gh_events_',
                },
              },
              testing: { webhook: { secret: TESTING_SECRET } },
              runners: { webhook: { secret: RUNNERS_SECRET } },
            }),
          },
        },
        { provide: getQueueToken('github'), useValue: githubQueue },
        { provide: getQueueToken('testing'), useValue: testingQueue },
        { provide: getQueueToken('perfs'), useValue: perfsQueue },
        { provide: getQueueToken('runners'), useValue: runnersQueue },
      ],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET / answers with the app status', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(response.body.name).toBe('zqueue');
  });

  it('POST /github/webhook records a signed delivery', async () => {
    const payload = { action: 'opened', issue: { number: 1 } };
    const body = JSON.stringify(payload);
    const response = await request(app.getHttpServer())
      .post('/github/webhook')
      .set('content-type', 'application/json')
      .set('x-github-event', 'issues')
      .set('x-github-delivery', 'guid-e2e-1')
      .set('x-hub-signature-256', sign256(body, GITHUB_SECRET))
      .send(body)
      .expect(202);
    expect(response.body).toEqual({ success: true, queued: true });
    expect(githubQueue.add).toHaveBeenCalledTimes(1);
    expect(githubQueue.add.mock.calls[0][1].index).toBe('gh_events_issues');
  });

  it('POST /github/webhook rejects a wrong signature with 401', async () => {
    const body = JSON.stringify({ action: 'opened' });
    await request(app.getHttpServer())
      .post('/github/webhook')
      .set('content-type', 'application/json')
      .set('x-github-event', 'issues')
      .set('x-hub-signature-256', sign256(body, 'wrong-secret'))
      .send(body)
      .expect(401);
    expect(githubQueue.add).not.toHaveBeenCalled();
  });

  it('POST /github/webhook rejects an unsigned delivery with 401', async () => {
    await request(app.getHttpServer())
      .post('/github/webhook')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ action: 'opened' }))
      .expect(401);
  });

  it('POST /github/webhook skips excluded events', async () => {
    const body = JSON.stringify({ ref: 'refs/heads/main' });
    const response = await request(app.getHttpServer())
      .post('/github/webhook')
      .set('content-type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-hub-signature-256', sign256(body, GITHUB_SECRET))
      .send(body)
      .expect(202);
    expect(response.body).toEqual({ success: true, queued: false });
    expect(githubQueue.add).not.toHaveBeenCalled();
  });

  it('POST /testing/webhook records a signed payload', async () => {
    const body = JSON.stringify({ name: 'module', version: '1.0.0' });
    await request(app.getHttpServer())
      .post('/testing/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, TESTING_SECRET))
      .send(body)
      .expect(202);
    expect(testingQueue.add).toHaveBeenCalledTimes(1);
  });

  it('POST /perfs/webhook records a signed payload', async () => {
    const body = JSON.stringify({ name: 'nightly-perf' });
    await request(app.getHttpServer())
      .post('/perfs/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, TESTING_SECRET))
      .send(body)
      .expect(202);
    expect(perfsQueue.add).toHaveBeenCalledTimes(1);
  });

  it('POST /perfs/webhook rejects a wrong signature with 401', async () => {
    const body = JSON.stringify({ name: 'nightly-perf' });
    await request(app.getHttpServer())
      .post('/perfs/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, 'wrong-secret'))
      .send(body)
      .expect(401);
    expect(perfsQueue.add).not.toHaveBeenCalled();
  });

  it('POST /runners/webhook records a signed runner usage report', async () => {
    const body = JSON.stringify(validRunnerUsage);
    await request(app.getHttpServer())
      .post('/runners/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, RUNNERS_SECRET))
      .send(body)
      .expect(202);
    expect(runnersQueue.add).toHaveBeenCalledTimes(1);
    expect(runnersQueue.add).toHaveBeenCalledWith('store', validRunnerUsage);
  });

  it('POST /runners/webhook rejects a wrong signature with 401', async () => {
    const body = JSON.stringify(validRunnerUsage);
    await request(app.getHttpServer())
      .post('/runners/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, 'wrong-secret'))
      .send(body)
      .expect(401);
    expect(runnersQueue.add).not.toHaveBeenCalled();
  });

  it('POST /runners/webhook does not accept the testing secret', async () => {
    const body = JSON.stringify(validRunnerUsage);
    await request(app.getHttpServer())
      .post('/runners/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, TESTING_SECRET))
      .send(body)
      .expect(401);
    expect(runnersQueue.add).not.toHaveBeenCalled();
  });

  it('POST /runners/webhook rejects a signed report with a value out of range with 400', async () => {
    const body = JSON.stringify({
      ...validRunnerUsage,
      usage: {
        ...validRunnerUsage.usage,
        cpu: { ...validRunnerUsage.usage.cpu, p95Pct: 140 },
      },
    });
    const response = await request(app.getHttpServer())
      .post('/runners/webhook')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', sign256(body, RUNNERS_SECRET))
      .send(body)
      .expect(400);
    expect(JSON.stringify(response.body)).toContain('usage.cpu.p95Pct');
    expect(runnersQueue.add).not.toHaveBeenCalled();
  });
});
