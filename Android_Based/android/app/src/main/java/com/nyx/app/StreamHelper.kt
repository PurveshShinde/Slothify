package com.nyx.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.runBlocking
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Stream URL resolver using WebView-based extraction
 * Preserves TTL cache and all recovery logic
 */
object StreamHelper {
    private const val TAG = "StreamHelper"
    
    private lateinit var appContext: Context
    
    /**
     * Initialize with application context
     * Must be called from Service onCreate
     */
    fun init(context: Context) {
        appContext = context.applicationContext
        Log.i(TAG, "StreamHelper initialized")
    }
    
    // ===== Cache =====
    
    data class CachedUrl(
        val url: String,
        val createdAt: Long
    )
    
    private const val URL_TTL_MS = 3 * 60_000L // 3 minutes
    private val urlCache = ConcurrentHashMap<String, CachedUrl>()
    
    private val executor = Executors.newSingleThreadExecutor()
    
    private fun isExpired(cached: CachedUrl): Boolean {
        return System.currentTimeMillis() - cached.createdAt > URL_TTL_MS
    }
    
    // ===== Public API =====
    
    /**
     * Get stream URL with TTL-based caching
     * Uses WebView-based extraction
     */
    fun getStreamUrl(videoId: String): String {
        Log.i(TAG, "Resolving stream for $videoId")
        
        val cached = urlCache[videoId]
        if (cached != null && !isExpired(cached)) {
            val ageSeconds = (System.currentTimeMillis() - cached.createdAt) / 1000
            Log.i(TAG, "✓ Using cached URL (age ${ageSeconds}s)")
            return cached.url
        }
        
        urlCache.remove(videoId)
        
        // WebView extraction (blocking call from IO thread)
        // BrowserExtractor uses coroutines internally for proper threading
        val url = runBlocking {
            BrowserExtractor.extractStreamUrl(videoId, appContext)
        }
        
        urlCache[videoId] = CachedUrl(url, System.currentTimeMillis())
        Log.i(TAG, "✓ Cached new URL (TTL ${URL_TTL_MS / 1000}s)")
        
        return url
    }
    
    /**
     * Force re-resolve URL (for error recovery)
     */
    fun invalidateCache(videoId: String) {
        urlCache.remove(videoId)
        Log.i(TAG, "Invalidated cache for $videoId")
    }
    
    /**
     * Clear all cached URLs
     */
    fun clearCache() {
        val size = urlCache.size
        urlCache.clear()
        Log.i(TAG, "Cleared cache ($size entries)")
    }
    
    /**
     * Prefetch stream URL for next track (gapless optimization)
     */
    fun prefetch(videoId: String) {
        val cached = urlCache[videoId]
        if (cached != null && !isExpired(cached)) {
            Log.d(TAG, "Prefetch skipped: $videoId already cached")
            return
        }
        
        Log.d(TAG, "Prefetching: $videoId")
        
        executor.execute {
            try {
                getStreamUrl(videoId)
                Log.i(TAG, "✓ Prefetched $videoId")
            } catch (e: Exception) {
                Log.w(TAG, "Prefetch failed for $videoId: ${e.message}")
            }
        }
    }
}
