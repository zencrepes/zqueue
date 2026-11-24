import type { PerfNode } from './perfNode.type.js';

// The payload sent to /perfs/webhook: the PerfNode contract plus the
// free-form fields accepted by the transformation.
export type PerfsPayload = PerfNode & {
  description?: string;
  tags?: Array<Record<string, unknown>>;
};
