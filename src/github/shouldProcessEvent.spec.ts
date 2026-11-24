import { shouldProcessEvent } from './shouldProcessEvent.js';

describe('shouldProcessEvent', () => {
  it('processes everything with a wildcard include', () => {
    expect(shouldProcessEvent('issues', ['*'], [])).toBe(true);
  });

  it('lets an exclude win over everything', () => {
    expect(shouldProcessEvent('push', ['*'], ['push'])).toBe(false);
    expect(shouldProcessEvent('push', ['push'], ['push'])).toBe(false);
  });

  it('lets an explicit include win over a wildcard exclude', () => {
    expect(shouldProcessEvent('issues', ['issues'], ['*'])).toBe(true);
  });

  it('excludes unmatched events when the exclude list has a wildcard', () => {
    expect(shouldProcessEvent('issues', [], ['*'])).toBe(false);
  });

  it('processes an event matched by no rule', () => {
    expect(shouldProcessEvent('issues', [], [])).toBe(true);
  });
});
