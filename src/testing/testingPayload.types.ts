export interface TestingPayloadDependency {
  name: string;
  version: string;
  url?: string;
}

export interface TestingPayloadCase {
  id: string;
  name: string;
  suite: string;
  createdAt: string;
  caseTotal: number;
  caseSuccess: number;
  caseFailure: number;
  [key: string]: unknown;
}

// The payload sent to /testing/webhook by testing pipelines.
export interface TestingPayload {
  id: string;
  name: string;
  version: string;
  createdAt: string;
  url: string;
  runTotal: number;
  runSuccess: number;
  runFailure: number;
  dependencies: TestingPayloadDependency[];
  cases?: TestingPayloadCase[];
  [key: string]: unknown;
}
