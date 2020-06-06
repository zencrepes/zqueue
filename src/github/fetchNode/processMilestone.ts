import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-milestones';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updateMilestone = async (
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

    const milestonesIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubMilestones,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      milestonesIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, milestonesIndex, nodes, console.log);
    logger.log('Node: ' + nodeId + ' submitted to Elasticsearch');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubMilestones,
        console.log,
      );
    }
  }
};

const processMilestonePayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted') {
    logger.log('Deleting milestone: ' + payload.milestone.node_id);
    try {
      await esClient.delete({
        id: payload.milestone.node_id,
        index: userConfig.elasticsearch.dataIndices.githubMilestones,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log(
        'Index: ' + userConfig.elasticsearch.dataIndices.githubMilestones,
      );
      logger.debug(payload);
    }
  } else {
    logger.log('Fetching data for milestone: ' + payload.milestone.node_id);
    await updateMilestone(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.milestone.node_id,
    );
  }
};

export default processMilestonePayload;
