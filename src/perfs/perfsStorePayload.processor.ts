import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { esMapping, esSettings, getId } from '@bit/zencrepes.zindexer.testing-perfs';
import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

import { ConfigService } from '../config.service';
import { EsClientService } from '../esClient.service';

@Processor('perfsstorepayload')
export class PerfsStorePayloadProcessor {
  private readonly logger = new Logger(PerfsStorePayloadProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly esClientService: EsClientService,
  ) {}

  @Process('perfsstore')
  async pushNodeToEs(job: Job) {
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(`Received a Perf event for: ${job.data.name} - Pushing Perf`);

    // Populating testing State

    // Check if the index exists, create it if it does not    
    await checkEsIndex(esClient, userConfig.elasticsearch.dataIndices.testingPerfs, esMapping, esSettings, console.log);

    // From the job data, get an array containing all available transaction name
    const transactionNames = []
    for (const run of job.data.runs) {
      for (const [k, v] of Object.entries(run.statistics)) {
        const transaction: any = v
        if (!transactionNames.includes(transaction.transaction)) {
          transactionNames.push(transaction.transaction)
        }
      }
    }

    // Transforming the object, objective is just to match to GitHub's to be consistent with the rest of the app
    const state = {
      ...job.data,
      id: getId(job.data),
      resources: {
        edges: job.data.resources.map((r) => {
          return {
            node: {
              ...r,
              id: getId(r)
            }
          }
        }),
        totalCount: job.data.resources.length
      },
      transactions: {
        edges: transactionNames.map((t) => {
          return {
            node: {
              name: t,
            }
          }
        }),
        totalCount: transactionNames.length
      },   
      runs: {
        edges: job.data.runs.map((r) => {
          return {
            node: {
              ...r,
              statistics: Object.entries(r.statistics).map((e: any) => {
                return e[1]
              }),
              id: getId(r)
            }
          }
        }),
        totalCount: job.data.runs.length
      }      
    }

    // Push single document to Elasticsearch
    await pushEsNodes(esClient, userConfig.elasticsearch.dataIndices.testingPerfs, [state], console.log);
  }
}
