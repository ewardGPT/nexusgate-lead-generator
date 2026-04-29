export function getRedisConnection() {
  const host = new URL(process.env.UPSTASH_REDIS_REST_URL!).hostname;
  return {
    host,
    port: 6379,
    username: "default",
    password: process.env.UPSTASH_REDIS_REST_TOKEN,
    tls: {}
  };
}
