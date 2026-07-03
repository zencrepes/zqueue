import { Logger } from '@nestjs/common';

import { GhClientService } from './ghClient.service';
import { ConfigService } from './config.service';

const buildConfigService = () =>
  ({
    getUserConfig: () => ({ github: { token: 'fake-token-1234' } }),
  } as ConfigService);

describe('GhClientService', () => {
  let service: GhClientService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GhClientService(buildConfigService());
    // Avoid real 1s pauses between queries
    (service as any).sleep = jest.fn().mockResolvedValue(undefined);
  });

  it('initializes an apollo client', () => {
    expect(service.getGhClient()).toBeDefined();
  });

  it('starts with a full rate limit', () => {
    expect(service.getRateLimit()).toEqual({
      limit: 5000,
      cost: 1,
      remaining: 5000,
      resetAt: null,
    });
  });

  it('stores an updated rate limit', () => {
    const rateLimit = { limit: 5000, cost: 2, remaining: 42, resetAt: 'later' };

    service.setRateLimit(rateLimit);

    expect(service.getRateLimit()).toEqual(rateLimit);
  });

  describe('graphqlQuery', () => {
    it('returns the query result and tracks the rate limit', async () => {
      const rateLimit = {
        limit: 5000,
        cost: 1,
        remaining: 4900,
        resetAt: '2026-01-01T00:00:00Z',
      };
      const queryMock = jest.fn().mockResolvedValue({
        data: { nodes: ['node-1'], rateLimit },
      });
      (service.getGhClient() as any).query = queryMock;

      const result = await service.graphqlQuery('QUERY', { id: '1' });

      expect(queryMock).toHaveBeenCalledWith({
        query: 'QUERY',
        variables: { id: '1' },
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      });
      expect(result.data.nodes).toEqual(['node-1']);
      expect(service.getRateLimit()).toEqual(rateLimit);
    });

    it('logs graphql errors returned in the response', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      (service.getGhClient() as any).query = jest.fn().mockResolvedValue({
        data: {
          errors: [{ message: 'Something went wrong' }],
          rateLimit: { limit: 5000, cost: 1, remaining: 4900, resetAt: 'x' },
        },
      });

      await service.graphqlQuery('QUERY', {});

      expect(warnSpy).toHaveBeenCalledWith('Something went wrong');
    });
  });

  describe('fetchNodesById', () => {
    it('returns the fetched nodes', async () => {
      (service as any).graphqlQuery = jest
        .fn()
        .mockResolvedValue({ data: { nodes: ['node-1', 'node-2'] } });

      const nodes = await service.fetchNodesById('QUERY', {
        nodesArray: ['id-1'],
      });

      expect(nodes).toEqual(['node-1', 'node-2']);
    });

    it('retries on failure and eventually recovers', async () => {
      (service as any).graphqlQuery = jest
        .fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ data: { nodes: ['node-1'] } });

      const nodes = await service.fetchNodesById('QUERY', {
        nodesArray: ['id-1'],
      });

      expect(nodes).toEqual(['node-1']);
      expect((service as any).graphqlQuery).toHaveBeenCalledTimes(2);
    });

    it('gives up after too many consecutive failures', async () => {
      (service as any).graphqlQuery = jest.fn().mockResolvedValue({});

      const result = await service.fetchNodesById('QUERY', {
        nodesArray: ['id-1'],
      });

      expect(result).toEqual({});
      expect((service as any).graphqlQuery).toHaveBeenCalledTimes(4);
    });
  });
});
