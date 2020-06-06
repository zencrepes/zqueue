<h1 align="center"> ZenCrepes Zqueue </h1><br>

<p align="center">
This repository contains ZenCrepes webhook handler, it processed webhook events received from GitHub.
</p>

# Documentation

You can find ZenCrepes documentation on [docs.zencrepes.io](https://docs.zencrepes.io/).

This readme only contains developer-focused details.

# Start Developing

Zqueue is a [Nest.js](http://nestjs.com/) app, it receives events from GitHub and places those in three Redis queues:

- **github**: Limited to processing one queue element at a time and per second (to play nicely with rate throttling), this queue initiates a call to GitHub to fetch additional metadata, not included in the webhook payload. The objective here is to reach content parity with nodes fetches using [Zencrepes's Zindexer](http://github.com/zencrepes/zindexer).
- **storepayload**: Pushes the payload to an elasticsearch index (one index per payload type) while trying to keep only one document per github node (overwrite on update). It aims at providing the latest state of a node.
- **storerawpayload**: Pushes the payload to an elasticsearch index (one index per payload type) and record the date at which the event was received. It aims at providing a timeline view of nodes lifecycle.

`storepayload` and `storerawpayload` are mostly there for those willing to diving in their data using a tool like Kibana or to archive GitHub events on their organization. ZenCrepes doesn't try to access datasets processed through these two queues.

## Launch the app

```bash
yarn
yarn run start:dev
```

Note: zqueue needs to be able to reach to an Elasticsearch and Redis instances

# Reach-out

I'd be more than happy to get feedback and external contributions, just submit a PR with your requested changes. Feel free to reach out on [slack](http://slack.overture.bio/), ZenCrepes has a dedicated channel on `#app_zencrepes`.

Overture gracefully provides the VM instance hosting dev & prod and the slack channel. ZenCrepes is not an Overture project.
