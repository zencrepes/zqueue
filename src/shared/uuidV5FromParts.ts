import { v5 as uuidv5 } from 'uuid';

// Namespace historically used by the ZenCrepes bit components; kept identical
// so documents indexed by zqueue v1 keep the same ids.
export const UUID_NAMESPACE = 'c72d8f12-1818-4cb9-bead-44634c441c11';

const prepString = (value: string): string =>
  value.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();

export const uuidV5FromParts = (...parts: string[]): string =>
  uuidv5(parts.map(prepString).join(''), UUID_NAMESPACE);
