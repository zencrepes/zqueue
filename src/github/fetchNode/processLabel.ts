import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-labels';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateLabel = async (
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
    const sourceId = currentNode.repository.id;
    const sourceName =
      currentNode.repository.owner.login + '/' + currentNode.repository.name;

    const nodes = ingestNodes(nodesData, 'zqueue', sourceId);

    const labelsIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubLabels,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      labelsIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, labelsIndex, nodes, console.log);
    logger.log('Node: ' + nodeId + ' submitted to Elasticsearch');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubLabels,
        console.log,
      );
    }
  }
};

const processLabelPayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted') {
    logger.log('Deleting label: ' + payload.label.node_id);
    try {
      await esClient.delete({
        id: payload.label.node_id,
        index: userConfig.elasticsearch.dataIndices.githubLabels,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log('Index: ' + userConfig.elasticsearch.dataIndices.githubLabels);
      logger.debug(payload);
    }
  } else {
    logger.log('Fetching data for label: ' + payload.label.node_id);
    await updateLabel(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.label.node_id,
    );
  }
};

export default processLabelPayload;
