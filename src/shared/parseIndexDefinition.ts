import { load } from 'js-yaml';

import type { IndexDefinition } from '../search/searchClient.types.js';

// The index mappings and settings inherited from the ZenCrepes bit components
// are YAML strings; this turns one mapping/settings pair into plain objects.
export const parseIndexDefinition = (
  mappingYaml: string,
  settingsYaml: string,
): IndexDefinition => ({
  mappings: load(mappingYaml) as Record<string, unknown>,
  settings: load(settingsYaml) as Record<string, unknown>,
});
