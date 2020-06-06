import { Logger, Injectable } from '@nestjs/common';
import { InMemoryCache } from 'apollo-cache-inmemory';
import ApolloClient from 'apollo-client';
import { ApolloLink, concat } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';

import { ConfigService } from './config.service';

@Injectable()
export class GhClientService {
  private readonly logger = new Logger(GhClientService.name);
  private readonly ghClient: ApolloClient<any>;
  private rateLimit = {
    limit: 5000,
    cost: 1,
    remaining: 5000,
    resetAt: null,
  };
  private errorRetry = 0;

  private sleep(ms: number) {
    //https://github.com/Microsoft/tslint-microsoft-contrib/issues/355
    // tslint:disable-next-line no-string-based-set-timeout
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  constructor(configService: ConfigService) {
    const userConfig = configService.getUserConfig();

    const httpLink = new HttpLink({
      uri: 'https://api.github.com/graphql',
      fetch: fetch as any, // eslint-disable-line
    });
    const cache = new InMemoryCache({
      addTypename: false,
    });
    const authMiddleware = new ApolloLink((operation: any, forward: any) => {
      // add the authorization to the headers
      operation.setContext({
        headers: {
          authorization: userConfig.github.token
            ? `Bearer ${userConfig.github.token}`
            : '',
        },
      });
      return forward(operation).map(
        (response: {
          errors: Array<object> | undefined;
          data: { errors: Array<object> };
        }) => {
          if (response.errors !== undefined && response.errors.length > 0) {
            response.data.errors = response.errors;
          }
          return response;
        },
      );
    });

    this.ghClient = new ApolloClient({
      link: concat(authMiddleware, httpLink),
      cache,
    });
    this.logger.log(
      'Github Client (Apollo) initialized with token: ' +
        userConfig.github.token.slice(0, 4) +
        '...',
    );
  }

  getGhClient() {
    return this.ghClient;
  }

  setRateLimit(rateLimit) {
    this.rateLimit = rateLimit;
  }

  getRateLimit() {
    return this.rateLimit;
  }

  graphqlQuery = async (query, variables) => {
    const rateLimit = this.getRateLimit();
    if (
      rateLimit.remaining - rateLimit.cost < 50 &&
      rateLimit.resetAt !== null
    ) {
      this.logger.log(
        'No token available, will resuming querying after ' + rateLimit.resetAt,
      );
      const sleepDuration =
        (new Date(rateLimit.resetAt).getTime() - new Date().getTime()) / 1000;
      this.logger.log('Will resume querying in: ' + sleepDuration + 's');
      await this.sleep(sleepDuration + 10000);
      this.logger.log('Ready to resume querying');
    }
    let data: any = {}; // eslint-disable-line
    try {
      data = await this.ghClient.query({
        query: query,
        variables,
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      });
    } catch (error) {
      this.logger.debug(JSON.stringify(query));
      this.logger.debug(variables);
      this.logger.debug('THIS IS AN ERROR');
      this.logger.debug(error);
    }

    if (
      data.data !== undefined &&
      data.data.errors !== undefined &&
      data.data.errors.length > 0
    ) {
      data.data.errors.forEach((error: { message: string }) => {
        this.logger.warn(error.message);
      });
    }
    if (data.data.rateLimit !== undefined) {
      this.logger.log(
        'GitHub Tokens - remaining: ' +
          data.data.rateLimit.remaining +
          ' query cost: ' +
          data.data.rateLimit.cost +
          ' (token will reset at: ' +
          data.data.rateLimit.resetAt +
          ')',
      );
      this.setRateLimit(data.data.rateLimit);
    }
    return data;
  };

  fetchNodesById = async (gqlQuery, queryParams) => {
    let data: any = {}; // eslint-disable-line
    if (this.errorRetry <= 3) {
      await this.sleep(1000); // Wait 1s between requests to avoid hitting GitHub API rate limit => https://developer.github.com/v3/guides/best-practices-for-integrators/
      const t0 = performance.now();
      try {
        data = await this.graphqlQuery(gqlQuery, queryParams);
      } catch (error) {
        this.logger.warn(error);
      }
      const t1 = performance.now();
      const callDuration = t1 - t0;
      if (data.data !== undefined && data.data !== null) {
        this.errorRetry = 0;
        return data.data.nodes;
      } else {
        this.errorRetry = this.errorRetry + 1;
        this.logger.log(
          'Error loading content, current count: ' + this.errorRetry,
        );
        data = await this.fetchNodesById(gqlQuery, queryParams);
      }
    }
    return data;
  };
}
