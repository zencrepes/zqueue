import processMilestonePayload from './processMilestone';

import { ingestNodes } from '@bit/zencrepes.zindexer.github-milestones';
import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

jest.mock('@bit/zencrepes.zindexer.github-milestones', () => ({
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
    dataIndices: { githubMilestones: 'gh_milestones' },
  },
});

const buildPayload = (action: string) => ({
  action,
  milestone: { node_id: 'milestone-1' },
});

const remoteNode = {
  id: 'milestone-id',
  repository: {
    id: 'repo-id',
    name: 'zqueue',
    owner: { login: 'zencrepes' },
  },
};

describe('processMilestonePayload', () => {
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
    await processMilestonePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('deleted'),
    );

    expect(esClient.delete).toHaveBeenCalledWith({
      id: 'milestone-1',
      index: 'gh_milestones',
    });
    expect(ghClientService.fetchNodesById).not.toHaveBeenCalled();
  });

  it('fetches the node and pushes it to Elasticsearch on other actions', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_milestones');

    await processMilestonePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('created'),
    );

    expect(ghClientService.fetchNodesById).toHaveBeenCalledWith(
      'FETCH_NODES_QUERY',
      { nodesArray: ['milestone-1'] },
    );
    expect(ingestNodes).toHaveBeenCalledWith([remoteNode], 'zqueue', 'repo-id');
    expect(getEsIndex).toHaveBeenCalledWith(
      'gh_milestones',
      false,
      'zencrepes/zqueue',
    );
    expect(checkEsIndex).toHaveBeenCalled();
    expect(pushEsNodes).toHaveBeenCalledWith(
      esClient,
      'gh_milestones',
      ['ingested-node'],
      expect.any(Function),
    );
    expect(aliasEsIndex).not.toHaveBeenCalled();
  });

  it('creates an index alias when using one index per source', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([remoteNode]);
    (ingestNodes as jest.Mock).mockReturnValue(['ingested-node']);
    (getEsIndex as jest.Mock).mockReturnValue('gh_milestones_zencrepes_zqueue');

    await processMilestonePayload(
      ghClientService,
      esClient,
      buildUserConfig(true),
      logger,
      buildPayload('created'),
    );

    expect(aliasEsIndex).toHaveBeenCalledWith(
      esClient,
      'gh_milestones',
      expect.any(Function),
    );
  });

  it('does not push anything when the node cannot be fetched', async () => {
    ghClientService.fetchNodesById.mockResolvedValue([]);

    await processMilestonePayload(
      ghClientService,
      esClient,
      buildUserConfig(),
      logger,
      buildPayload('created'),
    );

    expect(pushEsNodes).not.toHaveBeenCalled();
  });
});
