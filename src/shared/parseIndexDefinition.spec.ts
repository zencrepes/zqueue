import { parseIndexDefinition } from './parseIndexDefinition.js';

describe('parseIndexDefinition', () => {
  it('parses mapping and settings YAML strings into objects', () => {
    const mapping = 'properties:\n  id:\n    type: keyword\n';
    const settings = 'number_of_shards: 1\n';
    expect(parseIndexDefinition(mapping, settings)).toEqual({
      mappings: { properties: { id: { type: 'keyword' } } },
      settings: { number_of_shards: 1 },
    });
  });
});
