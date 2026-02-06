package com.nyx.app

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File

@OptIn(UnstableApi::class)
object NyxCache {
    private var cache: SimpleCache? = null
    fun getInstance(context: Context): SimpleCache {
        if (cache == null) {
            val databaseProvider = StandaloneDatabaseProvider(context)
            cache = SimpleCache(File(context.cacheDir, "media_cache"), NoOpCacheEvictor(), databaseProvider)
        }
        return cache!!
    }
}
