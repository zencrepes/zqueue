// One index per GitHub event type. Event names are sanitized to the
// characters allowed in Elasticsearch/OpenSearch index names.
export const eventIndexName = (prefix: string, event: string): string =>
  prefix + event.toLowerCase().replace(/[^a-z0-9_]/g, '_');
