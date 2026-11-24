import { createHmac } from 'node:crypto';

import { verifyWebhookSignature } from './verifyWebhookSignature.js';

const SECRET = 'webhook-test-secret';

const sign256 = (body: string, secret: string = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

const sign1 = (body: string, secret: string = SECRET) =>
  'sha1=' + createHmac('sha1', secret).update(body).digest('hex');

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ action: 'opened', number: 1 });

  it('accepts a valid sha256 signature', () => {
    expect(
      verifyWebhookSignature(Buffer.from(body), SECRET, {
        sha256: sign256(body),
      }),
    ).toBe(true);
  });

  it('accepts a valid sha1 signature when no sha256 header is sent', () => {
    expect(
      verifyWebhookSignature(Buffer.from(body), SECRET, { sha1: sign1(body) }),
    ).toBe(true);
  });

  it('prefers sha256 over sha1 when both are sent', () => {
    expect(
      verifyWebhookSignature(Buffer.from(body), SECRET, {
        sha256: sign256(body),
        sha1: 'sha1=invalid',
      }),
    ).toBe(true);
    expect(
      verifyWebhookSignature(Buffer.from(body), SECRET, {
        sha256: 'sha256=invalid',
        sha1: sign1(body),
      }),
    ).toBe(false);
  });

  it('rejects a signature computed with another secret', () => {
    expect(
      verifyWebhookSignature(Buffer.from(body), SECRET, {
        sha256: sign256(body, 'another-secret'),
      }),
    ).toBe(false);
  });

  it('rejects a signature over a different body', () => {
    expect(
      verifyWebhookSignature(Buffer.from('{"tampered":true}'), SECRET, {
        sha256: sign256(body),
      }),
    ).toBe(false);
  });

  it('rejects when no signature header is sent', () => {
    expect(verifyWebhookSignature(Buffer.from(body), SECRET, {})).toBe(false);
  });

  it('rejects everything when the secret is empty', () => {
    expect(
      verifyWebhookSignature(Buffer.from(body), '', { sha256: sign256(body) }),
    ).toBe(false);
  });

  it('rejects signatures of a different length without throwing', () => {
    expect(
      verifyWebhookSignature(Buffer.from(body), SECRET, { sha256: 'short' }),
    ).toBe(false);
  });
});
