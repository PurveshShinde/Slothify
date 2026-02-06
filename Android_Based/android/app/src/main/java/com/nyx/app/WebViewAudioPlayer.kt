package com.nyx.app

import android.content.Context
import android.util.Log
import android.view.View
import android.webkit.*
import android.os.Handler
import android.os.Looper
import org.json.JSONObject

/**
 * Hidden WebView audio player
 * Plays /watch pages directly without URL extraction
 */
class WebViewAudioPlayer(private val context: Context) {
    
    private val TAG = "WebViewAudioPlayer"
    private lateinit var webView: WebView
    
    // Interface for callbacks
    interface PlaybackCallback {
        fun onPlaybackStarted()
        fun onPlaybackPaused()
        fun onPlaybackEnded()
        fun onError(message: String)
        fun onPreloadReady()
        fun onStateUpdated(snapshot: PlaybackStateSnapshot)
    }

    private var playbackCallback: PlaybackCallback? = null
    
    // Invidious instances (rotate on failure)
    private val INSTANCES = listOf(
        "https://invidious.nerdvpn.de",
        "https://inv.nadeko.net",
        "https://yewtu.be",
        "https://invidious.drgns.space",
        "https://iv.melmac.space",
        "https://vid.puffyan.us"
    )
    private var currentInstanceIndex = 0
    
    // Playback state
    var isPreloading = false
        private set
    var videoId: String? = null
        private set
        
    // Metadata for Snapshot
    private var currentTitle: String = ""
    private var currentArtist: String = ""
    private var currentArtwork: String? = null
    
    // Telemetry Polling
    private val pollHandler = Handler(Looper.getMainLooper())
    private var lastSnapshot: PlaybackStateSnapshot? = null
    
    // Watchdog for playback start failures
    private val watchdogRunnable = Runnable {
        // Condition: If we are not playing OR we are playing but stuck at 0s after 8 seconds
        val lastPos = lastSnapshot?.positionMs ?: 0
        val lastState = lastSnapshot?.isPlaying == true
        val stuckAtStart = (videoId != null && !isPreloading && (!lastState || lastPos < 1000))
                           
        if (stuckAtStart) {
            Log.w(TAG, "Watchdog: Stuck! isPlaying=$lastState, pos=$lastPos. Rotating...")
            retryWithNextInstance()
        }
    }

    // JS Injection for Telemetry & Error Listeners
    private val telemetryJs = """
        (function() {
            try {
                var media = document.querySelector('video, audio');
                
                // Attempt to click overlay if present (Invidious often has this)
                var playBtn = document.querySelector('.vjs-big-play-button');
                if (playBtn && playBtn.offsetParent !== null) {
                    playBtn.click();
                }
                
                if (!media) return null;
                
                // Aggressive auto-play if paused
                if (media.paused) {
                    media.play().catch(e => {});
                }
                
                // Add error listener once if not added
                if (!media.dataset.errListener) {
                    media.dataset.errListener = "true";
                    media.addEventListener('error', function(e) {
                        try {
                            console.error("Media Error detected: " + (e.target.error ? e.target.error.code : 'unknown'));
                        } catch(err) {}
                    });
                }

                return {
                    isPlaying: !media.paused && !media.ended && media.readyState > 2,
                    currentTime: Math.floor(media.currentTime * 1000), // ms
                    duration: Math.floor(media.duration * 1000) || 0,   // ms
                    hasError: media.error != null
                };
            } catch (e) {
                return null;
            }
        })();
    """.trimIndent()
    
    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!isPreloading && videoId != null) {
                fetchTelemetry()
                pollHandler.postDelayed(this, 800) // Poll slightly slower (800ms) to allow JS execution
            }
        }
    }

    fun init() {
        webView = WebView(context.applicationContext).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                userAgentString = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                cacheMode = WebSettings.LOAD_DEFAULT 
                blockNetworkImage = true
            }
            visibility = View.GONE
            
            webChromeClient = object : WebChromeClient() {}
            
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    Log.i(TAG, "✓ Page loaded: $url")
                    
                    if (isPreloading) {
                        view?.evaluateJavascript("var m=document.querySelector('video, audio'); if(m) m.pause();", null)
                        playbackCallback?.onPreloadReady()
                    } else {
                        startPolling()
                        startWatchdog()
                        // Initial kick (though polling handles it now)
                        view?.evaluateJavascript("var m=document.querySelector('video, audio'); if(m) m.play();", null)
                    }
                }
                
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    val isMainFrame = request?.isForMainFrame == true
                    val url = request?.url?.toString() ?: ""
                    
                    if (isMainFrame) {
                        Log.e(TAG, "MainFrame Error: ${error?.description}")
                        retryWithNextInstance()
                    } else if (url.contains("videoplayback") || url.contains("googlevideo")) {
                        Log.e(TAG, "Stream Error: ${error?.description}")
                        retryWithNextInstance()
                    }
                }
            }
        }
    }
    
    fun play(id: String, title: String, artist: String, artwork: String?) {
        videoId = id
        currentTitle = title
        currentArtist = artist
        currentArtwork = artwork
        
        isPreloading = false
        lastSnapshot = null
        
        loadContext(id)
    }

    fun preload(id: String, title: String, artist: String, artwork: String?) {
        videoId = id
        currentTitle = title
        currentArtist = artist
        currentArtwork = artwork
        
        isPreloading = true
        loadContext(id)
    }
    
    private fun loadContext(id: String) {
        val instanceUrl = INSTANCES[currentInstanceIndex]
        // Use local=true to force simple player without proxies if supported, 
        // but for now stick to listen=1 which is standard Invidious audio mode
        val listenUrl = "$instanceUrl/watch?v=$id&listen=1"
        Log.i(TAG, "Loading: $listenUrl")
        
        stopPolling()
        stopWatchdog()
        
        webView.loadUrl(listenUrl)
    }
    
    fun pause() {
        webView.evaluateJavascript("document.querySelector('video, audio').pause();", null)
        isPreloading = false 
    }
    
    fun resume() {
        webView.evaluateJavascript("document.querySelector('video, audio').play();", null)
        if (!isPreloading) startPolling()
    }
    
    fun stop() {
        stopPolling()
        stopWatchdog()
        webView.loadUrl("about:blank")
        videoId = null
        lastSnapshot = null
    }

    fun seekTo(positionMs: Long) {
        val seconds = positionMs / 1000.0
        webView.evaluateJavascript("document.querySelector('video, audio').currentTime = $seconds;", null)
    }
    
    fun promoteToActive() {
        if (isPreloading) {
            isPreloading = false
            Log.i(TAG, "Promoting to active: $videoId")
            resume() // This should start polling and playback
            startWatchdog()
        }
    }
    
    private fun retryWithNextInstance() {
        rotateInstance()
        
        // UX Polish: Notify user
        pollHandler.post {
            try {
                android.widget.Toast.makeText(context, "Switching server...", android.widget.Toast.LENGTH_SHORT).show()
                webView.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
            } catch (e: Exception) {
                // Ignore UI errors
            }
        }
        
        videoId?.let { id ->
            Log.i(TAG, "Retrying with next instance for video: $id")
            loadContext(id)
        }
    }

    private fun fetchTelemetry() {
        webView.evaluateJavascript(telemetryJs) { result ->
             if (result == null || result == "null") return@evaluateJavascript

             try {
                var jsonStr = result
                if (jsonStr.startsWith("\"") && jsonStr.endsWith("\"")) {
                   jsonStr = jsonStr.substring(1, jsonStr.length - 1).replace("\\\"", "\"")
                }
                
                if (!jsonStr.startsWith("{")) return@evaluateJavascript

                val json = JSONObject(jsonStr)
                val isPlaying = json.optBoolean("isPlaying")
                val hasError = json.optBoolean("hasError")
                
                if (hasError) {
                    Log.w(TAG, "JS reported Media Error. Rotating...")
                    retryWithNextInstance()
                    return@evaluateJavascript
                }

                val position = json.optLong("currentTime")
                val duration = json.optLong("duration")
                
                // Watchdog: If we are rightfully playing and progressing, stop watchdog.
                if (isPlaying && position > 1000) {
                    stopWatchdog()
                }

                val snapshot = PlaybackStateSnapshot(
                    isPlaying = isPlaying,
                    positionMs = position,
                    durationMs = duration,
                    title = currentTitle,
                    artist = currentArtist,
                    videoId = videoId ?: "",
                    artworkUrl = currentArtwork
                )
                
                if (shouldEmit(snapshot)) {
                    lastSnapshot = snapshot
                    playbackCallback?.onStateUpdated(snapshot)
                }
             } catch (e: Exception) { }
        }
    }
    
    private fun shouldEmit(new: PlaybackStateSnapshot): Boolean {
        val old = lastSnapshot ?: return true
        if (old.isPlaying != new.isPlaying) return true
        if (old.videoId != new.videoId) return true
        if (kotlin.math.abs(old.positionMs - new.positionMs) >= 500) return true
        if (old.durationMs != new.durationMs) return true
        return false
    }

    // Checking methods are now redundant as we use telemetry
    fun checkProgress(callback: (Float, Float) -> Unit) { }
    
    fun rotateInstance() {
        currentInstanceIndex = (currentInstanceIndex + 1) % INSTANCES.size
        Log.i(TAG, "Rotated to instance: ${INSTANCES[currentInstanceIndex]}")
    }
    
    fun setPlaybackCallback(callback: PlaybackCallback) {
        this.playbackCallback = callback
    }
    
    private fun startPolling() {
        stopPolling()
        pollHandler.post(pollRunnable)
    }

    private fun stopPolling() {
        pollHandler.removeCallbacks(pollRunnable)
    }

    private fun startWatchdog() {
        stopWatchdog() // Clear existing
        pollHandler.postDelayed(watchdogRunnable, 8000) // 8s timeout
    }

    private fun stopWatchdog() {
        pollHandler.removeCallbacks(watchdogRunnable)
    }
    
    fun release() {
        stopPolling()
        stopWatchdog()
        Log.i(TAG, "Releasing WebView player")
        webView.loadUrl("about:blank")
        webView.destroy()
    }
}
