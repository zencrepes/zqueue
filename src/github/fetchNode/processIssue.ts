import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-issues';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateIssue = async (
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
    const currentNode = nodesData[0];
    console.log(nodesData);
    const sourceId = currentNode.repository.id;
    const sourceName =
      currentNode.repository.owner.login + '/' + currentNode.repository.name;

    const nodes = ingestNodes(nodesData, 'zqueue', userConfig, sourceId);

    const issuesIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubIssues,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      issuesIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, issuesIndex, nodes, console.log);
    logger.log('Node: ' + nodeId + ' submitted to Elasticsearch');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubIssues,
        console.log,
      );
    }
  }
};

const processIssuePayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted' || payload.action === 'transferred') {
    logger.log(
      'Deleting issue: ' +
        payload.issue.node_id +
        ' received action: ' +
        payload.action,
    );
    try {
      await esClient.delete({
        id: payload.issue.node_id,
        index: userConfig.elasticsearch.dataIndices.githubIssues,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log('Index: ' + userConfig.elasticsearch.dataIndices.githubIssues);
      logger.debug(payload);
    }
  } else {
    logger.log('Fetching data for issue: ' + payload.issue.node_id);
    await updateIssue(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.issue.node_id,
    );
  }
};

export default processIssuePayload;
