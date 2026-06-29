import type { CacheData, SyncMeta } from './types';

const PRICES_KEY = 'fuelscanner:prices';
const META_KEY = 'fuelscanner:meta';
const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min — cron runs every 10

// In-memory fallback when Redis isn't configured (dev / cold start)
let memCache: CacheData | null = null;

function hasRedis(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function getCached(): Promise<CacheData | null> {
  if (hasRedis()) {
    try {
      const r = await getRedis();
      return await r.get<CacheData>(PRICES_KEY);
    } catch {
      // fall through to memory
    }
  }
  return memCache;
}

export async function setCached(data: CacheData): Promise<void> {
  memCache = data;
  if (hasRedis()) {
    try {
      const r = await getRedis();
      // TTL of 1 hour — cron keeps it fresh; this is a safety net
      await r.set(PRICES_KEY, data, { ex: 3600 });
      const meta: SyncMeta = {
        lastSync: data.syncedAt,
        stationCount: data.stations.length,
        source: data.source,
      };
      await r.set(META_KEY, meta, { ex: 3600 });
    } catch {
      // already saved to memCache above
    }
  }
}

export async function getMeta(): Promise<SyncMeta | null> {
  if (hasRedis()) {
    try {
      const r = await getRedis();
      return await r.get<SyncMeta>(META_KEY);
    } catch {
      //
    }
  }
  if (memCache) {
    return {
      lastSync: memCache.syncedAt,
      stationCount: memCache.stations.length,
      source: memCache.source,
    };
  }
  return null;
}

export function isStale(syncedAt: string | null): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > STALE_THRESHOLD_MS;
}

export function nextSyncTime(syncedAt: string): string {
  return new Date(new Date(syncedAt).getTime() + 10 * 60 * 1000).toISOString();
}
