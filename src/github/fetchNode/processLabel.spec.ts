import processLabelPayload from './processLabel';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-labels';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-labels', () => ({
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
    dataIndices: { githubLabels: 'gh_labels' },
  },
});

const buildPayload = (action: string) => ({
  action,
  label: { node_id: 'label-1' },
});

const remoteNode = {
  id: 'label-id',
  repository: {
    id: 'repo-id',
    name: 'zqueue',
    owner: { login: 'zencrepes' },
  },
};

describe('processLabelPayload', () => {
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
    await processLabelPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'label-1',
      index: 'gh_labels',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('survives a failed deletion (node already gone)', async () => {
    esClient.delete.mockRejectedValue(new Error('document missing'));

    await expect(
      processLabelPayload(
        ghClientService,
        esClient,
        buildUserConfig(),
        logger,
        buildPayload('deleted'),
      ),
    ).resolves.toBeUndefined();
  });

  it('fetches the node and pushes it to Elasticsearch on other actions', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_labels');

    await processLabelPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('created'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['label-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith([remoteNode], 'zqueue', 'repo-id');
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_labels',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_labels_zencrepes_zqueue');

    await processLabelPayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('created'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_labels',
      expect.any(Function),
    );
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processLabelPayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('created'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
