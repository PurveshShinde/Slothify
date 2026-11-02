import type { Request, Response, NextFunction } from 'express';
import { redisCache } from '../services/redisClient.js';

export type KeyGenerator = (req: Request) => string | null;

/**
 * Higher-order Express middleware for Redis API response caching.
 * Serves cached responses in < 20ms.
 */
export function createCacheMiddleware(
    ttlSeconds: number,
    keyGenerator: KeyGenerator
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cacheKey = keyGenerator(req);
            if (!cacheKey) {
                return next();
            }

            // 1. Attempt to serve from Redis / in-memory cache
            const cachedData = await redisCache.get(cacheKey);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Cache-Engine', redisCache.isRedisConnected() ? 'Redis' : 'Memory');
                    return res.json(parsed);
                } catch {
                    // Invalid JSON in cache; ignore and re-fetch
                }
            }

            // 2. Cache Miss: Intercept res.json to store the response in Redis
            res.setHeader('X-Cache', 'MISS');
            const originalJson = res.json.bind(res);

            res.json = (body: any) => {
                // Only cache successful responses (2xx) with actual data
                if (res.statusCode >= 200 && res.statusCode < 300 && body !== undefined && body !== null) {
                    // Avoid caching empty search results or error structures
                    const isEmptyArray = Array.isArray(body) && body.length === 0;
                    if (!isEmptyArray && !body.error) {
                        try {
                            const serialized = JSON.stringify(body);
                            redisCache.set(cacheKey, serialized, ttlSeconds).catch((err) => {
                                console.warn('[RedisCache] Set error:', err.message);
                            });
                        } catch (serializeErr) {
                            // Non-serializable object; skip caching
                        }
                    }
                }
                return originalJson(body);
            };

            next();
        } catch (err: any) {
            console.warn('[CacheMiddleware] Warning:', err.message);
            next();
        }
    };
}

// 1. Search Queries: Cache for 5 minutes (300s) to keep results fresh while maintaining speed
export const searchCacheMiddleware = createCacheMiddleware(
    300, // 5 minutes
    (req: Request) => {
        const q = (req.query.q as string || '').toLowerCase().trim();
        return q ? `search:tracks:${q}` : null;
    }
);

export const artistSearchCacheMiddleware = createCacheMiddleware(
    300, // 5 minutes
    (req: Request) => {
        const q = (req.query.q as string || '').toLowerCase().trim();
        const limit = req.query.limit || 30;
        return q ? `search:artists:${q}:${limit}` : null;
    }
);

export const albumSearchCacheMiddleware = createCacheMiddleware(
    300, // 5 minutes
    (req: Request) => {
        const q = (req.query.q as string || '').toLowerCase().trim();
        return q ? `search:albums:${q}` : null;
    }
);

// 2. Artist/Album Pages: Cache for 24 hours (86400s)
export const artistProfileCacheMiddleware = createCacheMiddleware(
    86400, // 24 hours
    (req: Request) => {
        const id = (req.params.id || '').toLowerCase().trim();
        return id ? `artist:profile:${id}` : null;
    }
);

export const artistTracksCacheMiddleware = createCacheMiddleware(
    86400, // 24 hours
    (req: Request) => {
        const id = (req.params.id || '').toLowerCase().trim();
        return id ? `artist:tracks:${id}` : null;
    }
);

export const albumDetailsCacheMiddleware = createCacheMiddleware(
    86400, // 24 hours
    (req: Request) => {
        const id = (req.params.id || '').toLowerCase().trim();
        return id ? `album:details:${id}` : null;
    }
);
