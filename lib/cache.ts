import "server-only"

/**
 * Cache with Redis when REDIS_URL is set, in-memory Map otherwise.
 * Values are JSON-serialized; TTL in seconds.
 */

type CacheClient = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
}

const memory = new Map<string, { value: string; expires: number }>()

const memoryClient: CacheClient = {
  async get(key) {
    const entry = memory.get(key)
    if (!entry) return null
    if (entry.expires < Date.now()) {
      memory.delete(key)
      return null
    }
    return entry.value
  },
  async set(key, value, ttlSeconds) {
    if (memory.size > 5000) memory.clear()
    memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
  },
}

let client: CacheClient | null = null

async function getClient(): Promise<CacheClient> {
  if (client) return client
  if (process.env.REDIS_URL) {
    try {
      const { Redis } = await import("ioredis")
      const redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })
      await redis.connect()
      client = {
        get: (key) => redis.get(`sri:${key}`),
        set: (key, value, ttl) =>
          redis.set(`sri:${key}`, value, "EX", ttl).then(() => undefined),
      }
      return client
    } catch {
      // Redis unreachable — fall through to in-memory.
    }
  }
  client = memoryClient
  return client
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  produce: () => Promise<T>
): Promise<T> {
  const store = await getClient()
  const hit = await store.get(key).catch(() => null)
  if (hit !== null) {
    try {
      // SAFETY: values are written only via JSON.stringify below.
      return JSON.parse(hit) as T
    } catch {
      // Corrupt entry — regenerate.
    }
  }
  const value = await produce()
  store.set(key, JSON.stringify(value), ttlSeconds).catch(() => undefined)
  return value
}
