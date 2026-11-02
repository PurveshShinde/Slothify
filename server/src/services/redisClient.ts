import { Redis } from 'ioredis';

class InMemoryCache {
    private cache = new Map<string, { value: string; expiresAt: number }>();

    get(key: string): string | null {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    set(key: string, value: string, ttlSeconds: number): void {
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000
        });

        // Prune expired entries periodically if cache grows large
        if (this.cache.size > 2000) {
            const now = Date.now();
            for (const [k, v] of this.cache.entries()) {
                if (now > v.expiresAt) {
                    this.cache.delete(k);
                }
            }
        }
    }

    del(key: string): void {
        this.cache.delete(key);
    }
}

class RedisCacheService {
    private client: Redis | null = null;
    private memoryFallback = new InMemoryCache();
    private isConnected = false;
    private hasLoggedNotice = false;

    constructor() {
        const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';

        try {
            this.client = new Redis(redisUrl, {
                maxRetriesPerRequest: 1,
                connectTimeout: 3000,
                enableOfflineQueue: false,
                lazyConnect: true,
                retryStrategy: (times) => {
                    // Backoff retry: limit reconnect spam if Redis isn't running
                    if (times > 5) return null;
                    return Math.min(times * 1000, 3000);
                }
            });

            this.client.on('connect', () => {
                this.isConnected = true;
                console.log('[Redis] Connected successfully to Redis cache server.');
            });

            this.client.on('ready', () => {
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                this.isConnected = false;
                if (!this.hasLoggedNotice) {
                    this.hasLoggedNotice = true;
                    console.info('[Redis] Redis server not available. Using fast in-memory TTL caching fallback.');
                }
            });

            this.client.on('close', () => {
                this.isConnected = false;
            });

            // Attempt initial connection asynchronously without blocking server start
            this.client.connect().catch((_err) => {
                if (!this.hasLoggedNotice) {
                    this.hasLoggedNotice = true;
                    console.info('[Redis] Redis offline or connection refused. Falling back to in-memory TTL cache.');
                }
            });
        } catch (e: any) {
            console.warn('[Redis] Client initialization warning:', e.message);
            this.client = null;
        }
    }

    /**
     * Get a cached string or JSON value by key
     */
    async get(key: string): Promise<string | null> {
        if (this.isConnected && this.client) {
            try {
                return await this.client.get(key);
            } catch (err: any) {
                // Fail gracefully to memory fallback
            }
        }
        return this.memoryFallback.get(key);
    }

    /**
     * Set a cached value with TTL in seconds
     */
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
        if (this.isConnected && this.client) {
            try {
                await this.client.set(key, value, 'EX', ttlSeconds);
                return;
            } catch (err: any) {
                // Fail gracefully to memory fallback
            }
        }
        this.memoryFallback.set(key, value, ttlSeconds);
    }

    /**
     * Delete a cached key
     */
    async del(key: string): Promise<void> {
        if (this.isConnected && this.client) {
            try {
                await this.client.del(key);
            } catch (err: any) {}
        }
        this.memoryFallback.del(key);
    }

    /**
     * Clear all search cache keys across memory and Redis
     */
    async clearSearchCache(): Promise<void> {
        this.memoryFallback = new InMemoryCache();
        if (this.isConnected && this.client) {
            try {
                const keys = await this.client.keys('search:*');
                if (keys.length > 0) {
                    await this.client.del(...keys);
                }
            } catch (err: any) {}
        }
    }

    /**
     * Returns true if active Redis connection is established
     */
    isRedisConnected(): boolean {
        return this.isConnected;
    }
}

export const redisCache = new RedisCacheService();
