import { parseRedisUrl } from './parseRedisUrl.js';

describe('parseRedisUrl', () => {
  it('parses host and defaults the port to 6379', () => {
    expect(parseRedisUrl('redis://localhost')).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });

  it('parses an explicit port', () => {
    expect(parseRedisUrl('redis://queue.example.com:6380')).toEqual({
      host: 'queue.example.com',
      port: 6380,
    });
  });

  it('parses credentials and a database index', () => {
    expect(parseRedisUrl('redis://user:pass@localhost:6379/2')).toEqual({
      host: 'localhost',
      port: 6379,
      username: 'user',
      password: 'pass',
      db: 2,
    });
  });

  it('parses a password-only url', () => {
    expect(parseRedisUrl('redis://:pass@localhost')).toEqual({
      host: 'localhost',
      port: 6379,
      password: 'pass',
    });
  });

  it('decodes percent-encoded credentials', () => {
    expect(parseRedisUrl('redis://:p%40ss@localhost').password).toBe('p@ss');
  });
});
