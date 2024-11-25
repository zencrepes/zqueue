import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { esMapping, esSettings, StateNode, getId } from '@bit/zencrepes.zindexer.testing-states';
import { esMapping as esMappingRuns, esSettings as esSettingsRuns, RunNode, getRunId} from '@bit/zencrepes.zindexer.testing-runs';
import { esMapping as esMappingCases, esSettings as esSettingsCases, CaseNode, getCaseId} from './cases';
import { checkEsIndex, pushEsNodes } from '@bit/zencrepes.zindexer.es-utils';

import { ConfigService } from '../config.service';
import { EsClientService } from '../esClient.service';

@Processor('testingstorepayload')
export class TestingStorePayloadProcessor {
  private readonly logger = new Logger(TestingStorePayloadProcessor.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly esClientService: EsClientService,
  ) {}

  @Process('testingstore')
  async pushNodeToEs(job: Job) {
    const esClient = this.esClientService.getEsClient();
    const userConfig = this.configService.getUserConfig();

    this.logger.log(`Received a State event for: ${job.data.name}, version: ${job.data.version} - Pushing State`);

    // Populating testing State

    // Check if the index exists, create it if it does not    
    await checkEsIndex(esClient, userConfig.elasticsearch.dataIndices.testingStates, esMapping, esSettings, console.log);

    // Transforming the object, objective is just to match to GitHub's to be consistent with the rest of the app
    const state: StateNode = {
      ...job.data,
      full: job.data.name + '_' + job.data.version,
      dependencies: {
        edges: job.data.dependencies.map((d) => {
          return {
            node: {
              ...d,
              full: d.name + '_' + d.version,
              id: getId(d)
            }
          }
        }),
        totalCount: job.data.dependencies.length
      }
    }

    // Cases is a more recent addition, it should not be present in the state, not to pollute the index
    // with unnecessary data
    if ((state as any).cases !== undefined) {
      delete (state as any).cases;
    }

    // Push single document to Elasticsearch
    await pushEsNodes(esClient, userConfig.elasticsearch.dataIndices.testingStates, [state], console.log);

    // Populating testing Runs
    this.logger.log(`Event for: ${job.data.name}, version: ${job.data.version} - Pushing Run`);

    // Check if the index exists, create it if it does not    
    await checkEsIndex(esClient, userConfig.elasticsearch.dataIndices.testingRuns, esMappingRuns, esSettingsRuns, console.log);

    // Transforming the object, objective is just to match to GitHub's to be consistent with the rest of the app
    const run: RunNode = {
      ...job.data,
      id: getRunId(job.data),
      full: job.data.name + '_' + job.data.version,
      runSuccessRate: Math.round(job.data.runSuccess * 100 / job.data.runTotal),
      runFailureRate: Math.round(job.data.runFailure * 100 / job.data.runTotal),
      dependencies: {
        edges: job.data.dependencies.map((d) => {
          return {
            node: {
              ...d,
              full: d.name + '_' + d.version,
              id: getId(d)
            }
          }
        }),
        totalCount: job.data.dependencies.length
      }
    }

    // Cases is a more recent addition, it should not be present in the state, not to pollute the index
    // with unnecessary data
    if ((run as any).cases !== undefined) {
      delete (run as any).cases;
    }

    // Push single document to Elasticsearch
    await pushEsNodes(esClient, userConfig.elasticsearch.dataIndices.testingRuns, [run], console.log);

    if (job.data.cases !== undefined && job.data.cases.length > 0) {
      // Check if the index exists, create it if it does not    
      await checkEsIndex(esClient, userConfig.elasticsearch.dataIndices.testingCases, esMappingCases, esSettingsCases, console.log);    

      // Populating testing Cases
      this.logger.log(`Event for: ${job.data.name}, version: ${job.data.version} - Pushing ${job.data.cases.length} Cases`);

      const cases: CaseNode[] = job.data.cases.map((c) => {
        const caseObj = {
          ...c,
          id: getCaseId(c),
          full: c.suite + ' - ' + c.name,
          runId: run.id,
          url: run.url,
          caseSuccessRate: Math.round(c.caseSuccess * 100 / c.caseTotal),
          caseFailureRate: Math.round(c.caseFailure * 100 / c.caseTotal),
          project: run.name
        }
        return caseObj
      })

      // Push single document to Elasticsearch
      await pushEsNodes(esClient, userConfig.elasticsearch.dataIndices.testingCases, cases, console.log);

    }
  }
}
