import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignatureHeaders {
  sha256?: string;
  sha1?: string;
}

const matches = (received: string, expected: string): boolean => {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
};

// Verifies a GitHub-style HMAC signature computed over the raw request body.
// x-hub-signature-256 (sha256) is preferred; x-hub-signature (sha1) is kept
// for senders that still sign with the legacy header.
export const verifyWebhookSignature = (
  rawBody: Buffer | string,
  secret: string,
  signatures: SignatureHeaders,
): boolean => {
  if (secret === undefined || secret === '') {
    return false;
  }
  if (signatures.sha256 !== undefined && signatures.sha256 !== '') {
    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    return matches(signatures.sha256, expected);
  }
  if (signatures.sha1 !== undefined && signatures.sha1 !== '') {
    const expected =
      'sha1=' + createHmac('sha1', secret).update(rawBody).digest('hex');
    return matches(signatures.sha1, expected);
  }
  return false;
};
