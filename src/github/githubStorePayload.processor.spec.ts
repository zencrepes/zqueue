import { Logger } from '@nestjs/common';

import { GithubStorePayloadProcessor } from './githubStorePayload.processor';
import storePayload from './storePayload/index';

jest.mock('./storePayload/index');

describe('GithubStorePayloadProcessor', () => {
  const esClient = { search: jest.fn() };
  const userConfig = { github: {} };
  const configService = { getUserConfig: () => userConfig };
  const esClientService = { getEsClient: () => esClient };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates a store job to storePayload', () => {
    const processor = new GithubStorePayloadProcessor(
      configService as any,
      esClientService as any,
    );
    const job = {
      data: { payload: { action: 'opened' }, eventType: 'issues' },
    };

    processor.pushNodeToEs(job as any);

    expect(storePayload).toHaveBeenCalledWith(
      esClient,
      userConfig,
      expect.any(Logger),
      { action: 'opened' },
      'issues',
    );
  });
});
