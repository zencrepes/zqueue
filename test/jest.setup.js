// @nestjs/bull 0.1.x relies on util.isString, which was removed in Node 23.
// The runtime image is pinned to Node 22 (see Dockerfile); this shim keeps
// the test suite runnable on newer local Node versions until dependencies
// are modernized.
const util = require('util');

if (typeof util.isString !== 'function') {
  util.isString = (value) => typeof value === 'string';
}
