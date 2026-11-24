# Setup and deployment

This guide takes you from a blank machine to a zqueue instance that records GitHub events into a secured OpenSearch cluster. It covers local development, a docker-compose deployment, the creation of OpenSearch credentials from a blank instance, the GitHub webhook configuration, and browsing the recorded data with OpenSearch Dashboards.

## Prerequisites

- Docker with the compose plugin.
- Admin access to the GitHub organization or repository you want to record events from.
- For local development: Node.js 22 or newer.

## 1. Understand the configuration file

zqueue reads one YAML file: `~/.config/zindexer/config.yml` (the location changes with the `CONFIG_PATH` environment variable). The file is shared with [zindexer](https://github.com/zencrepes/zindexer). zqueue fills every key it does not find with a default, so a minimal file is enough:

```yaml
elasticsearch:
  # elasticsearch or opensearch
  engine: opensearch
  host: https://opensearch:9200
  # Credentials of the dedicated user created in section 4
  username: zqueue
  password: CHANGE_ME
  # false accepts the self-signed demo certificate OpenSearch ships with.
  # In production, install real certificates and set this back to true,
  # with sslCa pointing at your CA when it is a private one.
  sslVerify: false
redis:
  host: redis://redis:6379
github:
  webhook:
    # The same value goes into the GitHub webhook form (section 5)
    secret: CHANGE_ME
testing:
  webhook:
    secret: CHANGE_ME
```

Generate strong random values for the secrets and the password, for example with `openssl rand -hex 32`.

## 2. Get started locally (development)

```bash
git clone https://github.com/zencrepes/zqueue.git
cd zqueue
docker compose up -d        # Redis on :6379, secured OpenSearch on :9210
npm install
npm run start:dev           # listens on http://localhost:3003
```

The development compose file sets the OpenSearch admin password to `zQueue!Dev2026` (override it with the `OPENSEARCH_INITIAL_ADMIN_PASSWORD` environment variable). A matching `~/.config/zindexer/config.yml`:

```yaml
elasticsearch:
  engine: opensearch
  host: https://localhost:9210
  username: admin
  password: zQueue!Dev2026
  sslVerify: false
redis:
  host: redis://localhost:6379
github:
  webhook:
    secret: local-dev-secret
testing:
  webhook:
    secret: local-dev-secret
```

Send a signed test event and read it back:

```bash
SECRET=local-dev-secret
BODY='{"action":"opened","issue":{"number":1}}'
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')"
curl -X POST http://localhost:3003/github/webhook \
  -H 'content-type: application/json' \
  -H 'x-github-event: issues' \
  -H "x-hub-signature-256: $SIG" \
  -d "$BODY"

curl -k -u 'admin:zQueue!Dev2026' 'https://localhost:9210/gh_events_issues/_search?pretty'
```

A `202 {"success":true,"queued":true}` answer means the delivery was accepted; a `401` means the signature or the secret is wrong.

## 3. Deploy with docker compose

The [`deploy/`](../deploy) folder contains a ready-to-use stack: zqueue, Redis and OpenSearch, with persistent volumes.

```bash
cd deploy
cp config/config.yml.example config/config.yml
# Edit config/config.yml: secrets and the password of the zqueue user (section 4)

export OPENSEARCH_INITIAL_ADMIN_PASSWORD='<a strong admin password>'
docker compose up -d
```

What the stack does:

- **zqueue** listens on port 3003 and reads `./config/config.yml` (mounted at `/root/.config/zindexer`).
- **redis** buffers the deliveries; its data survives restarts in the `redis-data` volume.
- **opensearch** runs single-node with the security plugin enabled (TLS plus authentication) and stores its data in the `opensearch-data` volume. Port 9200 stays internal to the compose network; publish it only if you need direct access.
- **dashboards** serves OpenSearch Dashboards on port 5601, to browse the recorded events (section 6). Remove the service if you do not need a UI.

On the very first boot of a blank instance, OpenSearch creates the `admin` user with the password you pass through `OPENSEARCH_INITIAL_ADMIN_PASSWORD`. The variable only takes effect on first boot: changing it later does not change the password.

Put zqueue behind a TLS-terminating reverse proxy (nginx, Caddy, Traefik...) before exposing it to GitHub: the webhook secret travels in no header, but the payloads deserve transport encryption, and GitHub only needs to reach `POST /github/webhook`.

## 4. Create the OpenSearch credentials (from a blank instance)

Run zqueue with its own least-privilege user, not with `admin`. The three calls below run against a fresh OpenSearch started by the deploy stack. They use the security plugin REST API, authenticated as `admin`. `-k` accepts the self-signed demo certificate.

First, a role limited to what zqueue does: check the cluster health, check whether its indices exist and create them, and write documents through the bulk API. The bulk permission sits at the cluster level because the request names its indices per item. The index patterns match the defaults (`github.webhook.esIndexPrefix` and `elasticsearch.dataIndices`); adjust them if you changed those keys.

```bash
ADMIN="admin:$OPENSEARCH_INITIAL_ADMIN_PASSWORD"

curl -k -u "$ADMIN" -X PUT https://localhost:9200/_plugins/_security/api/roles/zqueue_writer \
  -H 'content-type: application/json' -d '{
  "cluster_permissions": ["cluster:monitor/health", "indices:data/write/bulk"],
  "index_permissions": [{
    "index_patterns": ["gh_events_*", "t_states_*", "t_runs_*", "t_cases_*", "t_perfs_*"],
    "allowed_actions": ["create_index", "write", "indices:admin/exists", "indices:admin/get"]
  }]
}'
```

Then the user. Pick a strong password; OpenSearch rejects one that is too weak or too similar to the user name (`Password is similar to user name`):

```bash
curl -k -u "$ADMIN" -X PUT https://localhost:9200/_plugins/_security/api/internalusers/zqueue \
  -H 'content-type: application/json' -d '{
  "password": "<the password that goes into config.yml>"
}'
```

Then map the user to the role:

```bash
curl -k -u "$ADMIN" -X PUT https://localhost:9200/_plugins/_security/api/rolesmapping/zqueue_writer \
  -H 'content-type: application/json' -d '{
  "users": ["zqueue"]
}'
```

Check the credentials work:

```bash
curl -k -u 'zqueue:<the password>' https://localhost:9200/_cluster/health
```

Finally, put `username: zqueue` and the password in `config/config.yml` and restart zqueue:

```bash
docker compose restart zqueue
```

When the calls run from your host, they need the OpenSearch port published; either uncomment the `ports` entry of the `opensearch` service for the time of the setup, or run the same `curl` calls from inside the container with `docker compose exec opensearch curl ...`.

## 5. Configure the GitHub webhook

In the GitHub organization (or a single repository): **Settings → Webhooks → Add webhook**.

- **Payload URL**: `https://<your host>/github/webhook`
- **Content type**: `application/json` (required: zqueue verifies the signature over the raw JSON body)
- **Secret**: the value of `github.webhook.secret` in `config.yml`
- **Events**: "Send me everything" records all events; zqueue stores each type in its own index. To drop types you do not want, list them in `github.webhook.excludeGithubEvents`.

GitHub sends a `ping` event on creation. Check the delivery got a `202` under **Recent Deliveries**, then look for the `gh_events_ping` index. The `zqueue` role writes but does not read, so browse the data with the `admin` user (or a dedicated read-only user), with `curl` or with OpenSearch Dashboards (section 6):

```bash
curl -k -u "$ADMIN" 'https://localhost:9200/_cat/indices/gh_events_*?v'
```

A rejected delivery shows a `401` in Recent Deliveries, and zqueue logs the reason. Redeliveries are safe: the GitHub delivery GUID is the document id, so a redelivered event overwrites its own document instead of creating a duplicate.

## 6. Browse the data with OpenSearch Dashboards

OpenSearch Dashboards is the OpenSearch equivalent of Kibana (it started as a fork of Kibana 7.10). The deploy stack of section 3 serves it on [http://localhost:5601](http://localhost:5601); the development stack of section 2 starts it with `docker compose --profile dashboards up -d`.

1. Log in as `admin`. The `zqueue` user of section 4 cannot log in: its role only writes.
2. Open the menu, then **Dashboards Management** → **Index patterns** → **Create index pattern**.
3. Enter `gh_events_*` and pick `receivedAt` as the time field.
4. Open **Discover** to search and filter the recorded events, and build charts from them under **Visualize**.

The testing and performance indices work the same way, with the patterns `t_states_*`, `t_runs_*`, `t_cases_*` (time field `createdAt`) and `t_perfs_*` (time field `startedAt`).

With `engine: elasticsearch`, the equivalent tool is [Kibana](https://www.elastic.co/kibana), pointed at the same cluster.

## Troubleshooting

- **`401 Invalid webhook signature`**: the secret differs between `config.yml` and the GitHub webhook form, or the webhook content type is not `application/json`.
- **`202` but no document**: the delivery is queued in Redis and retried; check the zqueue logs (`docker compose logs zqueue`). A `security_exception` means the role of section 4 misses an index pattern (for example after changing `esIndexPrefix`).
- **`Could not reach the search cluster at startup`**: the host, the credentials, or the TLS options in `elasticsearch` are wrong. With the demo certificates, `sslVerify: false` is required.
- **First boot of OpenSearch exits immediately**: `OPENSEARCH_INITIAL_ADMIN_PASSWORD` was missing or too weak; it needs at least 8 characters with upper case, lower case, a digit and a special character.
