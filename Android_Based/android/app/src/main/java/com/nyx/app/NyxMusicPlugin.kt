package com.nyx.app

import android.app.DownloadManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@CapacitorPlugin(name = "NyxMusic")
@OptIn(UnstableApi::class)
class NyxMusicPlugin : Plugin() {

    private var controller: MediaController? = null
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Main)
    
    // Receiver for download progress events
    private val downloadReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                val type = it.getStringExtra("type") ?: "update"
                val videoId = it.getStringExtra("videoId") ?: ""
                val progress = it.getIntExtra("progress", 0)
                
                val ret = JSObject()
                ret.put("type", type)
                ret.put("videoId", videoId)
                ret.put("progress", progress)
                
                notifyListeners("downloadEvent", ret)
            }
        }
    }

    // Receiver for playback events
    private val playbackReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                val ret = JSObject()
                ret.put("isPlaying", it.getBooleanExtra("isPlaying", false))
                ret.put("position", it.getLongExtra("position", 0))
                ret.put("duration", it.getLongExtra("duration", 0))
                ret.put("title", it.getStringExtra("title") ?: "")
                ret.put("artist", it.getStringExtra("artist") ?: "")
                ret.put("videoId", it.getStringExtra("videoId") ?: "")
                
                notifyListeners("playbackState", ret)
            }
        }
    }

    override fun load() {
        // ... (SessionToken logic removed as we use Manual PlaybackState)
        
        // Register Broadcast Receivers
        androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(context)
            .registerReceiver(downloadReceiver, android.content.IntentFilter("com.nyx.app.DOWNLOAD_EVENT"))
            
        androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(context)
            .registerReceiver(playbackReceiver, android.content.IntentFilter("com.nyx.app.PLAYBACK_EVENT"))
    }


    /* ... Existing Playback Methods ... */
    
    @PluginMethod
    fun loadTrack(call: PluginCall) {
        val url = call.getString("url")
        val videoId = if (url != null) extractVideoId(url) else call.getString("videoId")
        
        if (videoId == null) {
            call.reject("Video ID or valid URL is required")
            return
        }
        
        // Metadata
        val title = call.getString("title")
        val artist = call.getString("artist")
        val artwork = call.getString("artwork") // or thumbnail
        
        // Allow UI to pass known local path to avoid scanning
        val knownPath = call.getString("localPath")
        
        val intent = Intent(context, NyxPlaybackService::class.java)
        context.startService(intent)
        
        bindAndRun(call) { service ->
            service.loadTrack(videoId, title, artist, artwork, knownPath)
        }
    }

    @PluginMethod
    fun queueNext(call: PluginCall) {
        val url = call.getString("url") ?: return call.reject("URL required")
        val videoId = extractVideoId(url) ?: return call.reject("Invalid URL")
        val title = call.getString("title")
        val artist = call.getString("artist")
        val artwork = call.getString("artwork")
        
        bindAndRun(call) { service ->
            service.queueNextTrack(videoId, title, artist, artwork)
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        bindAndRun(call) { it.pausePlayback() }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        bindAndRun(call) { it.resumePlayback() }
    }
    
    @PluginMethod
    fun seekTo(call: PluginCall) {
        val position = call.getLong("position") ?: return call.reject("Position required")
        bindAndRun(call) { it.seekTo(position) }
    }

    /* ... Download Management Methods ... */
    
    @PluginMethod
    fun downloadAudio(call: PluginCall) {
        val videoId = call.getString("videoId") ?: return call.reject("Video ID required")
        
        // Extract metadata
        val metadata = mutableMapOf<String, String>()
        metadata["title"] = call.getString("title") ?: "Unknown Title"
        metadata["artist"] = call.getString("artist") ?: "Unknown Artist"
        metadata["thumbnail"] = call.getString("thumbnail") ?: ""
        metadata["duration"] = call.getString("duration") ?: "0:00"
        
        // Playlist metadata
        if (call.getBoolean("isPlaylist", false) == true) {
            metadata["isPlaylist"] = "true"
            metadata["playlistId"] = call.getString("playlistId") ?: "unknown_playlist"
            metadata["playlistName"] = call.getString("playlistName") ?: "Unknown Playlist"
        }
        
        bindAndRun(call) { service ->
           service.downloadTrack(videoId, metadata)
        }
    }
    
    @PluginMethod
    fun getDownloads(call: PluginCall) {
        scope.launch(Dispatchers.IO) {
            try {
                val dir = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
                val nyxDir = java.io.File(dir, "Nyx")
                
                val singles = JSArray()
                val playlists = JSArray()
                
                if (nyxDir.exists()) {
                    // 1. Scan Singles: Nyx/Downloads/<videoId>/audio.m4a
                    val downloadsDir = java.io.File(nyxDir, "Downloads")
                    if (downloadsDir.exists()) {
                        downloadsDir.listFiles()?.forEach { trackDir ->
                            if (trackDir.isDirectory) {
                                val videoId = trackDir.name
                                val audioFile = java.io.File(trackDir, "audio.m4a")
                                val jsonFile = java.io.File(trackDir, "meta.json")
                                
                                if (audioFile.exists()) {
                                    val item = parseTrackJson(videoId, audioFile, jsonFile)
                                    singles.put(item)
                                }
                            }
                        }
                    }
                    
                    // 2. Scan Playlists: Nyx/Playlists/<id>/<videoId>.m4a
                    val playlistsDir = java.io.File(nyxDir, "Playlists")
                    if (playlistsDir.exists()) {
                        playlistsDir.listFiles()?.forEach { playlistDir ->
                            if (playlistDir.isDirectory) {
                                val playlistId = playlistDir.name
                                val playlistObj = JSObject()
                                playlistObj.put("playlistId", playlistId)
                                // Try to find playlist meta
                                val playlistMeta = java.io.File(playlistDir, "meta.json") // Not impl yet but good to have
                                playlistObj.put("title", playlistId) // Fallback
                                
                                val tracks = JSArray()
                                playlistDir.listFiles()?.forEach { file ->
                                    if (file.name.endsWith(".m4a")) {
                                        val videoId = file.name.removeSuffix(".m4a")
                                        val jsonFile = java.io.File(playlistDir, "$videoId.json")
                                        
                                        val item = parseTrackJson(videoId, file, jsonFile)
                                        tracks.put(item)
                                    }
                                }
                                playlistObj.put("tracks", tracks)
                                playlists.put(playlistObj)
                            }
                        }
                    }
                    
                    // Compatibility: Scan root for legacy downloads (Step 6 leftovers)
                    nyxDir.listFiles()?.forEach { file ->
                        if (file.name.endsWith(".m4a")) {
                            val videoId = file.name.removeSuffix(".m4a")
                            val jsonFile = java.io.File(nyxDir, "$videoId.json")
                            val item = parseTrackJson(videoId, file, jsonFile)
                            singles.put(item)
                        }
                    }
                }
                
                val ret = JSObject()
                ret.put("singles", singles)
                ret.put("playlists", playlists)
                // Legacy support for UI until updated
                ret.put("downloads", singles) 
                
                call.resolve(ret)
                
            } catch (e: Exception) {
                call.reject("Failed to list downloads", e)
            }
        }
    }
    
    private fun parseTrackJson(videoId: String, audioFile: java.io.File, jsonFile: java.io.File): JSObject {
        val item = JSObject()
        item.put("videoId", videoId)
        item.put("filePath", audioFile.absolutePath)
        item.put("size", audioFile.length())
        
        if (jsonFile.exists()) {
            try {
                val jsonStr = jsonFile.readText()
                val jsonObj = org.json.JSONObject(jsonStr)
                item.put("title", jsonObj.optString("title", "Unknown"))
                item.put("artist", jsonObj.optString("artist", "Unknown"))
                item.put("thumbnail", jsonObj.optString("thumbnail"))
                item.put("duration", jsonObj.optString("duration"))
                item.put("timestamp", jsonObj.optLong("downloadedAt", jsonObj.optLong("timestamp")))
            } catch (e: Exception) {
                Log.w("NyxMusicPlugin", "Error parsing JSON for $videoId")
            }
        } else {
             item.put("title", videoId)
        }
        return item
    }

    @PluginMethod
    fun deleteDownload(call: PluginCall) {
        val videoId = call.getString("videoId") ?: return call.reject("videoId required")
        // NOTE: This needs to be smarter to find the file or accept a path. 
        // For now, let's defer complex delete logic or just recursively search/delete.
        call.resolve()
    }
    
    @PluginMethod
    fun checkDownloadStatus(call: PluginCall) {
        val videoId = call.getString("videoId") ?: return call.reject("videoId required")
        
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
        val file = java.io.File(dir, "Nyx/$videoId.m4a")
        
        val ret = JSObject()
        ret.put("isDownloaded", file.exists())
        call.resolve(ret)
    }

    @PluginMethod
    fun search(call: PluginCall) {
        val query = call.getString("query") ?: return call.reject("Query required")
        
        scope.launch(Dispatchers.IO) {
            val instances = listOf(
                "https://invidious.nerdvpn.de",
                "https://inv.nadeko.net",
                "https://yewtu.be",
                "https://invidious.drgns.space",
                "https://iv.melmac.space",
                "https://vid.puffyan.us"
            )

            var resultId: String? = null

            for (instance in instances) {
                try {
                    val encodedQuery = java.net.URLEncoder.encode(query, "UTF-8")
                    val url = "$instance/api/v1/search?q=$encodedQuery&type=video"
                    Log.d("NyxMusicPlugin", "Searching on: $instance")
                    
                    val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                    connection.connectTimeout = 5000
                    connection.readTimeout = 5000
                    connection.requestMethod = "GET"

                    if (connection.responseCode == 200) {
                        val jsonStr = connection.inputStream.bufferedReader().use { it.readText() }
                        val jsonArray = org.json.JSONArray(jsonStr)
                        if (jsonArray.length() > 0) {
                            val firstItem = jsonArray.getJSONObject(0)
                            resultId = firstItem.optString("videoId")
                            if (!resultId.isNullOrEmpty()) {
                                Log.i("NyxMusicPlugin", "Found videoId: $resultId on $instance")
                                break 
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.w("NyxMusicPlugin", "Search failed on $instance: ${e.message}")
                }
            }

            val ret = JSObject()
            if (resultId != null) {
                ret.put("videoId", resultId)
            } else {
                ret.put("videoId", null)
            }
            call.resolve(ret)
        }
    }

    override fun handleOnDestroy() {
        controllerFuture?.let { MediaController.releaseFuture(it) }
        
        val localBroadcastManager = androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(context)
        localBroadcastManager.unregisterReceiver(downloadReceiver)
        localBroadcastManager.unregisterReceiver(playbackReceiver)
        
        super.handleOnDestroy()
    }
    
    // Generic Helper
    private fun bindAndRun(call: PluginCall, action: (NyxPlaybackService) -> Unit) {
        val intent = Intent(context, NyxPlaybackService::class.java)
        context.bindService(intent, object : android.content.ServiceConnection {
            override fun onServiceConnected(name: android.content.ComponentName?, service: android.os.IBinder?) {
                val binder = service as? NyxPlaybackService.LocalBinder
                binder?.getService()?.let { action(it) }
                context.unbindService(this)
                call.resolve()
            }
            override fun onServiceDisconnected(name: android.content.ComponentName?) {}
        }, android.content.Context.BIND_AUTO_CREATE)
    }
    
    private fun extractVideoId(url: String): String? {
        return when {
            url.contains("?v=") -> url.substringAfter("?v=").substringBefore("&")
            url.contains("/watch/") -> url.substringAfter("/watch/").substringBefore("?")
            url.length == 11 -> url // Already a video ID
            else -> null
        }
    }
}
