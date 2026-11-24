import { buildEventDocument } from './buildEventDocument.js';

const receivedAt = new Date('2026-11-24T10:00:00.000Z');

describe('buildEventDocument', () => {
  it('records the whole payload with a metadata envelope', () => {
    const payload = {
      action: 'opened',
      issue: { number: 1 },
      repository: { full_name: 'zencrepes/zqueue' },
      organization: { login: 'zencrepes' },
      sender: { login: 'someuser' },
    };
    const document = buildEventDocument(
      'issues',
      payload,
      {
        'x-github-delivery': 'delivery-guid-1',
        'x-github-hook-id': '42',
        'x-github-hook-installation-target-type': 'organization',
        'x-github-hook-installation-target-id': '1337',
      },
      receivedAt,
    );
    expect(document.id).toBe('delivery-guid-1');
    expect(document.body).toEqual({
      id: 'delivery-guid-1',
      event: 'issues',
      action: 'opened',
      receivedAt: '2026-11-24T10:00:00.000Z',
      repository: 'zencrepes/zqueue',
      organization: 'zencrepes',
      sender: 'someuser',
      delivery: {
        id: 'delivery-guid-1',
        hookId: '42',
        targetType: 'organization',
        targetId: '1337',
      },
      payload,
    });
  });

  it('generates an id when GitHub sends no delivery header', () => {
    const document = buildEventDocument('ping', {}, {}, receivedAt);
    expect(document.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('handles payloads without repository or sender', () => {
    const document = buildEventDocument(
      'ping',
      { zen: 'Design.' },
      {},
      receivedAt,
    );
    expect(document.body.repository).toBeNull();
    expect(document.body.organization).toBeNull();
    expect(document.body.sender).toBeNull();
    expect(document.body.action).toBeNull();
  });
});
