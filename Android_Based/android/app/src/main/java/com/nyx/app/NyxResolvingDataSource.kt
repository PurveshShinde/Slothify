package com.nyx.app

import android.net.Uri
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.ResolvingDataSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import java.io.IOException

class NyxResolvingDataSource(
    private val upstreamFactory: DataSource.Factory
) : DataSource.Factory {

    override fun createDataSource(): DataSource {
        val resolver = ResolvingDataSource.Resolver { dataSpec ->
            val uri = dataSpec.uri
            
            // Intercept YouTube URLs: https://www.youtube.com/watch?v=VIDEO_ID
            if (uri.scheme == "https" && 
                uri.host == "www.youtube.com" && 
                uri.path == "/watch") {
                
                val videoId = uri.getQueryParameter("v")
                if (videoId != null) {
                    try {
                        // Resolve the YouTube video ID to a direct audio stream URL
                        val streamUrl = resolveStream(videoId)
                        if (!streamUrl.isNullOrEmpty()) {
                            return@Resolver dataSpec.buildUpon()
                                .setUri(Uri.parse(streamUrl))
                                .build()
                        } else {
                            // FATAL: If resolution fails, log and throw to prevent invalid playback
                            System.err.println("[FATAL] Extraction Failed for video ID: $videoId - No stream URL returned")
                            throw IOException("[FATAL] Failed to resolve audio stream for video ID: $videoId. Cannot proceed with playback.")
                        }
                    } catch (e: IOException) {
                        // Re-throw IOException with fatal logging
                        System.err.println("[FATAL] Extraction Failed for video ID: $videoId - ${e.message}")
                        e.printStackTrace()
                        throw e
                    } catch (e: Exception) {
                        // Catch any other exception and convert to IOException with fatal logging
                        System.err.println("[FATAL] Extraction Failed for video ID: $videoId - Unexpected error: ${e.message}")
                        e.printStackTrace()
                        throw IOException("[FATAL] Stream resolution error for $videoId: ${e.message}. Player stopped to prevent MalformedURLException.", e)
                    }
                }
            }
            
            // Return original DataSpec for non-YouTube URLs
            dataSpec
        }

        return ResolvingDataSource(upstreamFactory.createDataSource(), resolver)
    }

    private fun resolveStream(videoId: String): String? {
        // Run blocking is acceptable because ResolvingDataSource calls this on a background thread
        return runBlocking {
            withContext(Dispatchers.IO) {
                try {
                    val url = StreamHelper.getStreamUrl(videoId)
                    System.out.println("[NyxResolvingDataSource] ✓ Stream resolved for $videoId")
                    url
                } catch (e: Exception) {
                    System.err.println("[NyxResolvingDataSource] ✗ Resolution failed for $videoId: ${e.message}")
                    System.err.println("[NyxResolvingDataSource] This will trigger graceful error handling")
                    null
                }
            }
        }
    }
}
