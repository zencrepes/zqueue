import { Logger } from '@nestjs/common';

import { GithubProcessor } from './github.processor';
import fetchNode from './fetchNode/index';

jest.mock('./fetchNode/index');

describe('GithubProcessor', () => {
  const esClient = { search: jest.fn() };
  const userConfig = { github: {} };
  const configService = { getUserConfig: () => userConfig };
  const esClientService = { getEsClient: () => esClient };
  const ghClientService = { fetchNodesById: jest.fn() };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates a fetchRemoteNode job to the fetchNode dispatcher', () => {
    const processor = new GithubProcessor(
      configService as any,
      ghClientService as any,
      esClientService as any,
    );
    const job = {
      data: { payload: { action: 'opened' }, eventType: 'issues' },
    };

    processor.handlFetchNode(job as any);

    expect(fetchNode).toHaveBeenCalledWith(
      ghClientService,
      esClient,
      userConfig,
      expect.any(Logger),
      { action: 'opened' },
      'issues',
    );
  });
});
