import type { IndexDefinition } from '../search/searchClient.types.js';

// The metadata envelope is mapped explicitly; the raw payload keeps dynamic
// mapping, bounded by the total-fields limit (GitHub payloads are large).
export const eventsIndexDefinition: IndexDefinition = {
  settings: {
    number_of_shards: 1,
    'index.mapping.nested_fields.limit': 100,
    'index.mapping.total_fields.limit': 5000,
  },
  mappings: {
    dynamic: true,
    properties: {
      id: { type: 'keyword' },
      event: { type: 'keyword' },
      action: { type: 'keyword' },
      receivedAt: { type: 'date' },
      repository: { type: 'keyword' },
      organization: { type: 'keyword' },
      sender: { type: 'keyword' },
      delivery: {
        properties: {
          id: { type: 'keyword' },
          hookId: { type: 'keyword' },
          targetType: { type: 'keyword' },
          targetId: { type: 'keyword' },
        },
      },
    },
  },
};
