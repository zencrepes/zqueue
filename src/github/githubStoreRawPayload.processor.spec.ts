import { Logger } from '@nestjs/common';

import { GithubStoreRawPayloadProcessor } from './githubStoreRawPayload.processor';
import storeRawPayload from './storeRawPayload/index';

jest.mock('./storeRawPayload/index');

describe('GithubStoreRawPayloadProcessor', () => {
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

  it('delegates a store job to storeRawPayload', () => {
    const processor = new GithubStoreRawPayloadProcessor(
      configService as any,
      esClientService as any,
    );
    const job = {
      data: { payload: { action: 'opened' }, eventType: 'issues' },
    };

    processor.pushRawToEs(job as any);

    expect(storeRawPayload).toHaveBeenCalledWith(
      esClient,
      userConfig,
      expect.any(Logger),
      { action: 'opened' },
      'issues',
    );
  });
});
