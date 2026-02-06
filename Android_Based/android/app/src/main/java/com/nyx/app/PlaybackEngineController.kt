package com.nyx.app

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import java.io.File

/**
 * Step 6: Central Controller for Playback Engines
 * Guarantees mutual exclusion between WebView (Streaming) and ExoPlayer (Offline)
 */
class PlaybackEngineController(
    private val context: Context,
    private val callback: WebViewQueueManager.QueueCallback
) {
    private val TAG = "PlaybackEngineController"

    enum class PlaybackEngine {
        WEBVIEW_STREAMING,
        EXOPLAYER_OFFLINE,
        IDLE
    }

    private var currentEngine = PlaybackEngine.IDLE
    
    // Engine Instances
    private var webViewQueueManager: WebViewQueueManager? = null
    private var exoPlayer: ExoPlayer? = null
    
    // Track Info
    private var currentVideoId: String? = null
    private var currentTitle: String = ""
    private var currentArtist: String = ""
    private var currentArtwork: String? = null
    
    // Polling only for ExoPlayer position updates (WebView handles its own)
    private val exoPollHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val exoPollRunnable = object : Runnable {
        override fun run() {
            if (currentEngine == PlaybackEngine.EXOPLAYER_OFFLINE && exoPlayer?.isPlaying == true) {
                emitExoSnapshot()
                exoPollHandler.postDelayed(this, 500)
            }
        }
    }

    init {
        // Initialize Streaming Engine immediately
        webViewQueueManager = WebViewQueueManager(context, callback)
    }

    /**
     * Switch to Streaming Engine and play
     */
    fun playStreaming(videoId: String, title: String, artist: String, artwork: String?) {
        Log.i(TAG, "Requesting Streaming: $videoId")
        
        stopExoPolling()
        releaseExoPlayer()
        
        currentEngine = PlaybackEngine.WEBVIEW_STREAMING
        currentVideoId = videoId
        currentTitle = title
        currentArtist = artist
        currentArtwork = artwork
        
        webViewQueueManager?.play(videoId, title, artist, artwork)
    }

    /**
     * Switch to Offline Engine and play
     */
    fun playOffline(file: File, videoId: String, title: String, artist: String, artwork: String?) {
        Log.i(TAG, "Requesting Offline: $videoId")
        
        webViewQueueManager?.pause()
        
        currentEngine = PlaybackEngine.EXOPLAYER_OFFLINE
        currentVideoId = videoId
        currentTitle = title
        currentArtist = artist
        currentArtwork = artwork
        
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                        .build(),
                    true
                )
                .setHandleAudioBecomingNoisy(true)
                .build()
            
            exoPlayer?.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    emitExoSnapshot() // State change triggers update
                    if (state == Player.STATE_ENDED) {
                        callback.onPlaybackEnded()
                        stopExoPolling()
                    } else if (state == Player.STATE_READY && exoPlayer?.isPlaying == true) {
                         startExoPolling()
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    emitExoSnapshot()
                    if (isPlaying) {
                        callback.onPlaybackStarted(currentVideoId ?: "")
                        startExoPolling()
                    } else {
                        callback.onPlaybackPaused()
                        stopExoPolling()
                    }
                }
                
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                     callback.onError("Offline playback error: ${error.message}")
                }
            })
        }
        
        val mediaItem = MediaItem.fromUri(Uri.fromFile(file))
        exoPlayer?.setMediaItem(mediaItem)
        exoPlayer?.prepare()
        exoPlayer?.play()
    }

    fun queueNext(videoId: String, title: String, artist: String, artwork: String?) {
        webViewQueueManager?.queueNext(videoId, title, artist, artwork)
    }

    fun pause() {
        when (currentEngine) {
            PlaybackEngine.WEBVIEW_STREAMING -> webViewQueueManager?.pause()
            PlaybackEngine.EXOPLAYER_OFFLINE -> exoPlayer?.pause()
            else -> {}
        }
    }

    fun resume() {
        when (currentEngine) {
            PlaybackEngine.WEBVIEW_STREAMING -> webViewQueueManager?.resume()
            PlaybackEngine.EXOPLAYER_OFFLINE -> exoPlayer?.play()
            else -> {}
        }
    }

    fun stop() {
        webViewQueueManager?.stop()
        exoPlayer?.stop()
        stopExoPolling()
        currentEngine = PlaybackEngine.IDLE
    }
    
    fun seekTo(positionMs: Long) {
         when (currentEngine) {
            PlaybackEngine.WEBVIEW_STREAMING -> webViewQueueManager?.seekTo(positionMs)
            PlaybackEngine.EXOPLAYER_OFFLINE -> {
                exoPlayer?.seekTo(positionMs)
                emitExoSnapshot()
            }
            else -> {}
        }
    }

    fun release() {
        webViewQueueManager?.release()
        releaseExoPlayer()
        currentEngine = PlaybackEngine.IDLE
    }

    private fun releaseExoPlayer() {
        stopExoPolling()
        if (exoPlayer != null) {
            Log.i(TAG, "Releasing ExoPlayer")
            exoPlayer?.release()
            exoPlayer = null
        }
    }
    
    // ExoPlayer helper to bridge to Snapshot model
    private fun emitExoSnapshot() {
        val player = exoPlayer ?: return
        val snapshot = PlaybackStateSnapshot(
            isPlaying = player.isPlaying,
            positionMs = player.currentPosition,
            durationMs = if (player.duration != C.TIME_UNSET) player.duration else 0,
            title = currentTitle,
            artist = currentArtist,
            videoId = currentVideoId ?: "",
            artworkUrl = currentArtwork
        )
        callback.onStateUpdated(snapshot)
    }
    
    private fun startExoPolling() {
        stopExoPolling()
        exoPollHandler.post(exoPollRunnable)
    }
    
    private fun stopExoPolling() {
        exoPollHandler.removeCallbacks(exoPollRunnable)
    }
    
    fun getActiveEngine() = currentEngine
}
