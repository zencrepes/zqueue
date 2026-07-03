import processReleasePayload from './processRelease';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-releases';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-releases', () => ({
  fetchNodesById: 'FETCH_NODES_QUERY',
  ingestNodes: jest.fn(),
  esMapping: { mappings: {} },
  esSettings: { settings: {} },
}));

jest.mock('@bit/zencrepes.zindexer.es-utils', () => ({
  getEsIndex: jest.fn(),
  checkEsIndex: jest.fn(),
  pushEsNodes: jest.fn(),
  aliasEsIndex: jest.fn(),
}));

const buildUserConfig = (oneIndexPerSource = false) => ({
  elasticsearch: {
    oneIndexPerSource,
    dataIndices: { githubReleases: 'gh_releases' },
  },
});

const buildPayload = (action: string) => ({
  action,
  release: { node_id: 'release-1' },
  repository: {
    node_id: 'repo-id',
    name: 'zqueue',
    owner: { node_id: 'owner-id', login: 'zencrepes' },
  },
});

const expectedRepoObj = {
  id: 'repo-id',
  name: 'zqueue',
  url: 'https://github.com/zencrepes/zqueue',
  owner: {
    id: 'owner-id',
    login: 'zencrepes',
    url: 'https://github.com/zencrepes',
  },
};

const remoteNode = { id: 'release-id' };

describe('processReleasePayload', () => {
  let ghClientService: { fetchNodesById: jest.Mock };
  let esClient: { delete: jest.Mock };
  let logger: { log: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    ghClientService = { fetchNodesById: jest.fn().mockResolvedValue([]) };
    esClient = { delete: jest.fn().mockResolvedValue({}) };
    logger = { log: jest.fn(), debug: jest.fn() };
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
  });

  it('deletes the node from Elasticsearch on a deleted action', async () => {
    await processReleasePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'release-1',
      index: 'gh_releases',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('fetches the node and pushes it to Elasticsearch on other actions', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_releases');

    await processReleasePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('published'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['release-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith(
      [remoteNode],
      'zqueue',
      'repo-id',
      expectedRepoObj,
    );
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_releases',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_releases',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_releases_zencrepes_zqueue');

    await processReleasePayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('published'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_releases',
      expect.any(Function),
    );
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processReleasePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('published'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
