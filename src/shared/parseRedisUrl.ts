export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
}

export const parseRedisUrl = (redisUrl: string): RedisConnectionOptions => {
  const url = new URL(redisUrl);
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : NaN;
  return {
    host: url.hostname,
    port: url.port === '' ? 6379 : Number(url.port),
    ...(url.username !== '' && { username: decodeURIComponent(url.username) }),
    ...(url.password !== '' && { password: decodeURIComponent(url.password) }),
    ...(!Number.isNaN(db) && { db }),
  };
};
