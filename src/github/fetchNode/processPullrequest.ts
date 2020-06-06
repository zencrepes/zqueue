import {
  fetchNodesById,
  ingestNodes,
  esMapping,
  esSettings,
} from '@bit/zencrepes.zindexer.github-pullrequests';

import {
  getEsIndex,
  checkEsIndex,
  pushEsNodes,
  aliasEsIndex,
} from '@bit/zencrepes.zindexer.es-utils';

const updatePullrequest = async (
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

    const nodes = ingestNodes(nodesData, 'zqueue', userConfig, sourceId);

    const pullrequestsIndex = getEsIndex(
      userConfig.elasticsearch.dataIndices.githubPullrequests,
      userConfig.elasticsearch.oneIndexPerSource,
      sourceName,
    );
    await checkEsIndex(
      esClient,
      pullrequestsIndex,
      esMapping,
      esSettings,
      console.log,
    );
    await pushEsNodes(esClient, pullrequestsIndex, nodes, console.log);
    logger.log('Node: ' + nodeId + ' submitted to Elasticsearch');

    if (userConfig.elasticsearch.oneIndexPerSource === true) {
      // Create an alias used for group querying
      await aliasEsIndex(
        esClient,
        userConfig.elasticsearch.dataIndices.githubPullrequests,
        console.log,
      );
    }
  }
};

const processPullrequestPayload = async (
  ghClientService,
  esClient,
  userConfig,
  logger,
  payload,
) => {
  if (payload.action === 'deleted') {
    logger.log('Deleting pullrequest: ' + payload.pull_request.node_id);
    try {
      await esClient.delete({
        id: payload.pull_request.node_id,
        index: userConfig.elasticsearch.dataIndices.githubPullrequests,
      });
    } catch (e) {
      logger.log('Error deleting node, it was probably already deleted');
      logger.log('ID: ' + payload.label.node_id);
      logger.log(
        'Index: ' + userConfig.elasticsearch.dataIndices.githubPullrequests,
      );
      logger.debug(payload);
    }
  } else {
    logger.log(
      'Fetching data for pullrequest: ' + payload.pull_request.node_id,
    );
    await updatePullrequest(
      ghClientService,
      esClient,
      userConfig,
      logger,
      payload.pull_request.node_id,
    );
  }
};

export default processPullrequestPayload;
