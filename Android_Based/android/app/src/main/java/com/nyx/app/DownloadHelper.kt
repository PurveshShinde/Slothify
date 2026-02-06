package com.nyx.app

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.util.Log

/**
 * Helper for downloading audio files via Android DownloadManager
 */
object DownloadHelper {
    
    private const val TAG = "DownloadHelper"

    /**
     * Enqueue a download request for the audio stream
     */
    /**
     * Enqueue a download request for the audio stream
     */
    fun downloadAudio(
        context: Context,
        downloadContext: DownloadContext,
        streamUrl: String
    ): Long {
        Log.i(TAG, "Starting download for: ${downloadContext.title} (${downloadContext.videoId})")
        
        try {
            val relativePath = getRelativePath(downloadContext)
            val filename = "${downloadContext.videoId}.m4a.partial"
            
            val request = DownloadManager.Request(Uri.parse(streamUrl))
                .setTitle(downloadContext.title)
                .setDescription(downloadContext.artist)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
                .setDestinationInExternalFilesDir(
                    context,
                    Environment.DIRECTORY_MUSIC,
                    "$relativePath/$filename"
                )
            
            val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            return manager.enqueue(request)
            
        } catch (e: Exception) {
            Log.e(TAG, "Download enqueue failed", e)
            throw e
        }
    }

    /**
     * Finalize download by renaming .partial to .m4a and verifying metadata
     */
    fun finalizeDownload(context: Context, downloadContext: DownloadContext): Boolean {
        try {
            val dir = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            val relativePath = getRelativePath(downloadContext)
            val folder = java.io.File(dir, relativePath)
            
            val partialFile = java.io.File(folder, "${downloadContext.videoId}.m4a.partial")
            val finalFile = java.io.File(folder, "audio.m4a") // Single track folder structure -> audio.m4a
            // Wait, user request for Singles: Nyx/Downloads/<videoId>/audio.m4a
            // User request for Playlists: Nyx/Playlists/<id>/<videoId>.m4a
            
            // Adjust final filename based on context
            val finalFileName = if (downloadContext.isPlaylist) {
                "${downloadContext.videoId}.m4a" // Flattened in playlist folder
            } else {
                "audio.m4a" // Clean name in dedicated folder
            }
            val targetFile = java.io.File(folder, finalFileName)

            if (partialFile.exists()) {
                if (targetFile.exists()) targetFile.delete() // Overwrite existing
                
                val renamed = partialFile.renameTo(targetFile)
                if (renamed) {
                    Log.i(TAG, "Download finalized: ${downloadContext.videoId} -> ${targetFile.absolutePath}")
                    return true
                } else {
                     Log.e(TAG, "Failed to rename partial file for ${downloadContext.videoId}")
                }
            } else {
                 Log.e(TAG, "Partial file not found for ${downloadContext.videoId} at ${partialFile.absolutePath}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error finalizing download", e)
        }
        return false
    }
    

    /**
     * Write metadata sidecar file (meta.json or <videoId>.json)
     */
    fun writeMetadata(
        context: Context,
        downloadContext: DownloadContext,
        metadata: Map<String, String>
    ) {
        try {
            val dir = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            val relativePath = getRelativePath(downloadContext)
            val folder = java.io.File(dir, relativePath)
            
            // Ensure directory exists
            if (!folder.exists()) folder.mkdirs()
            
            // Filename strategy
            val metaFileName = if (downloadContext.isPlaylist) {
                "${downloadContext.videoId}.json"
            } else {
                "meta.json"
            }
            
            val file = java.io.File(folder, metaFileName)
            
            val json = org.json.JSONObject()
            json.put("videoId", downloadContext.videoId)
            json.put("title", downloadContext.title)
            json.put("artist", downloadContext.artist)
            json.put("downloadedAt", System.currentTimeMillis())
            json.put("source", "youtube")
            
            // Add extra metadata
            metadata.forEach { (key, value) ->
                if (!json.has(key)) json.put(key, value)
            }
            
            file.writeText(json.toString())
            Log.i(TAG, "Metadata saved for ${downloadContext.videoId}")
            
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write metadata", e)
        }
    }
    
    /**
     * Determine folder path based on context
     */
    private fun getRelativePath(context: DownloadContext): String {
        return if (context.isPlaylist && context.playlistId != null) {
            "Nyx/Playlists/${sanitize(context.playlistId)}" // Flat playlist folder
        } else {
            "Nyx/Downloads/${context.videoId}" // Dedicated track folder
        }
    }
    
    private fun sanitize(name: String): String {
        return name.replace(Regex("[^a-zA-Z0-9.\\-]"), "_")
    }
}
