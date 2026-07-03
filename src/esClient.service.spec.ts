import { Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import * as fs from 'fs';

import { EsClientService } from './esClient.service';
import { ConfigService } from './config.service';

jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn(),
}));

const buildConfigService = (elasticsearch) =>
  ({
    getUserConfig: () => ({ elasticsearch }),
  } as ConfigService);

describe('EsClientService', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects to Elastic Cloud when cloud credentials are provided', () => {
    new EsClientService(
      buildConfigService({
        cloudId: 'deployment:abcdef',
        username: 'elastic',
        password: 'fake-password',
        host: 'http://127.0.0.1:9200',
      }),
    );

    expect(Client).toHaveBeenCalledWith({
      cloud: {
        id: 'deployment:abcdef',
        username: 'elastic',
        password: 'fake-password',
      },
    });
  });

  it('connects with an SSL certificate authority when configured', () => {
    const readFileSyncSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockReturnValue('FAKE-CA-CONTENT');

    new EsClientService(
      buildConfigService({
        host: 'https://es.internal:9200',
        sslCa: '/path/to/ca.pem',
      }),
    );

    expect(readFileSyncSpy).toHaveBeenCalledWith('/path/to/ca.pem');
    expect(Client).toHaveBeenCalledWith({
      node: 'https://es.internal:9200',
      ssl: { ca: 'FAKE-CA-CONTENT' },
    });
    readFileSyncSpy.mockRestore();
  });

  it('connects to a plain host when no cloud or ssl settings are provided', () => {
    new EsClientService(buildConfigService({ host: 'http://127.0.0.1:9200' }));

    expect(Client).toHaveBeenCalledWith({ node: 'http://127.0.0.1:9200' });
  });

  it('ignores incomplete cloud credentials', () => {
    new EsClientService(
      buildConfigService({
        cloudId: 'deployment:abcdef',
        username: '',
        password: '',
        host: 'http://127.0.0.1:9200',
      }),
    );

    expect(Client).toHaveBeenCalledWith({ node: 'http://127.0.0.1:9200' });
  });

  it('exposes the created client', () => {
    const service = new EsClientService(
      buildConfigService({ host: 'http://127.0.0.1:9200' }),
    );

    expect(service.getEsClient()).toBe((Client as jest.Mock).mock.instances[0]);
  });
});
