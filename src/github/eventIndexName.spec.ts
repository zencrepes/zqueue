import { eventIndexName } from './eventIndexName.js';

describe('eventIndexName', () => {
  it('concatenates the prefix and the event name', () => {
    expect(eventIndexName('gh_events_', 'issues')).toBe('gh_events_issues');
  });

  it('lowercases and sanitizes unusual event names', () => {
    expect(eventIndexName('gh_events_', 'Check-Run.completed')).toBe(
      'gh_events_check_run_completed',
    );
  });
});
