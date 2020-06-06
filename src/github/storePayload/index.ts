import { v4 as uuidv4 } from 'uuid';

import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

import esSettings from './esSettings';
import esMapping from './esMapping';

const storePayload = async (
  esClient,
  userConfig,
  logger,
  payload,
  eventType: string,
) => {
  const indexName =
    userConfig.github.webhook.nodePayload.esIndexPrefix + eventType;
  await checkEsIndex(esClient, indexName, esMapping, esSettings, console.log);

  let nodeId = '';
  if (
    payload[eventType] !== undefined &&
    payload[eventType].node_id !== undefined
  ) {
    nodeId = payload[eventType].node_id;
  } else {
    nodeId = uuidv4();
  }

  const preppedPayload = { id: nodeId, ...payload };

  await pushEsNodes(esClient, indexName, [preppedPayload], console.log);
};

export default storePayload;
