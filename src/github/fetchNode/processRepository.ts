import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-repos';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

export const updateRepository = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  nodeId,
) => {
  const queryParams = { nodesArray: [nodeId] };
  const nodesData = await ghClientService.fetchNodesById(
    fetchNodesById,
    queryParams,
  );

  if (nodesData.length > 0) {
    const sourceName = nodesData[0].owner.login + '/' + nodesData[0].name;

    const nodes = ingestNodes(nodesData, 'zqueue');

    const reposIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubRepos,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      reposIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, reposIndex, nodes, console.log);
    logger.log('Node: ' + nodeId + ' submitted to Elasticsearch');
  }

  if (userConfig.elasticsearch.oneIndexPerSource === true) {
    // Create an alias used for group querying
    await aliasEsIndex(
      esClient,
      userConfig.elasticsearch.dataIndices.GithubRepos,
      console.log,
    );
  }
};

const processRepositoryPayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted') {
    logger.log('Deleting repository: ' + payload.repository.node_id);
    try {
      await esClient.delete({
        id: payload.repository.node_id,
        index: userConfig.elasticsearch.dataIndices.githubRepos,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log('Index: ' + userConfig.elasticsearch.dataIndices.githubIssues);
      logger.debug(payload);
    }
  } else {
    logger.log('Fetching data for repository: ' + payload.repository.node_id);

    // Update the repository
    await updateRepository(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.repository.node_id,
    );
  }
};

export default processRepositoryPayload;
