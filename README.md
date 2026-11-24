<h1 align="center"> Zqueue </h1><br>

<p align="center">
Zqueue is the ZenCrepes webhook listener. It records every event it receives into Elasticsearch or OpenSearch, for downstream analysis.
</p>

# Documentation

You can find ZenCrepes documentation on [docs.zencrepes.io](https://docs.zencrepes.io/), issues should be created [here](https://github.com/zencrepes/zencrepes/issues)

This readme only contains developer-focused details. [docs/setup.md](docs/setup.md) walks through the full setup: getting started, deploying with docker compose, creating the OpenSearch credentials from a blank instance, and configuring the GitHub webhook.

# What zqueue does

Zqueue is a [Nest.js](http://nestjs.com/) app that exposes three webhook endpoints. Each endpoint verifies the HMAC signature of the delivery, then places the payload in a Redis queue ([BullMQ](https://bullmq.io/)). A worker picks the job up and writes it to the search engine, with retries when the engine is unreachable.

- **POST /github/webhook**: records GitHub events as they are received, one index per event type (`gh_events_issues`, `gh_events_pull_request`, ...). Each document carries the raw payload plus a small envelope (event, action, repository, organization, sender, delivery id, receive date). The GitHub delivery GUID is the document id, so redeliveries do not create duplicates. Zqueue does not call GitHub back: what arrives is what is stored.
- **POST /testing/webhook**: records a testing state event into the states, runs and cases indices.
- **POST /perfs/webhook**: records a performance report into the perfs index.

Signatures use `x-hub-signature-256` (sha256, preferred) or `x-hub-signature` (sha1), computed over the raw request body. An invalid or missing signature is answered with `401`.

# Configuration

Zqueue reads `~/.config/zindexer/config.yml` (change the location with the `CONFIG_PATH` environment variable). The file is shared with [zindexer](http://github.com/zencrepes/zindexer); zqueue only reads the sections below and fills any missing key with its default:

```yaml
elasticsearch:
  # elasticsearch or opensearch
  engine: opensearch
  host: https://localhost:9200
  # Basic authentication (works with both engines)
  username: admin
  password: ''
  # Path to a CA certificate, for clusters with a private CA
  sslCa: ''
  # Set to false to accept self-signed certificates
  sslVerify: true
  # Elastic Cloud only (engine: elasticsearch)
  cloudId: ''
redis:
  host: redis://localhost:6379
github:
  webhook:
    secret: PLEASE_CHANGE_ME
    # Event filtering: exclude wins over include, '*' is a wildcard
    includeGithubEvents: ['*']
    excludeGithubEvents: []
    esIndexPrefix: gh_events_
testing:
  webhook:
    secret: PLEASE_CHANGE_ME
```

Supported engines:

- **Elasticsearch** 8/9, plain, with basic authentication, or through Elastic Cloud (`cloudId`).
- **OpenSearch** 2/3, plain or with the security plugin (basic authentication over TLS, `sslCa`/`sslVerify` for the certificate).

# Start developing

Start the local dependencies (Redis, and a secured OpenSearch):

```bash
docker compose up -d
```

Then:

```bash
npm install
npm run start:dev
```

Zqueue listens on port 3003 (override with `PORT`). Useful scripts:

```bash
npm run lint       # eslint, with fixes
npm test           # unit tests (vitest)
npm run test:cov   # unit tests with coverage thresholds
npm run test:e2e   # HTTP-level tests of the webhook endpoints
npm run build      # compile to dist/
```

To send a signed test event:

```bash
BODY='{"action":"opened","issue":{"number":1}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$YOUR_SECRET" | sed 's/^.* /sha256=/')
curl -X POST http://localhost:3003/github/webhook \
  -H 'content-type: application/json' \
  -H 'x-github-event: issues' \
  -H "x-hub-signature-256: $SIG" \
  -d "$BODY"
```

# Docker

```bash
docker build -t zencrepes/zqueue .
docker run -p 3003:3003 -v ~/.config/zindexer:/root/.config/zindexer zencrepes/zqueue
```

For a full stack (zqueue, Redis and a secured OpenSearch), use the compose file in [deploy/](deploy) and follow [docs/setup.md](docs/setup.md).
