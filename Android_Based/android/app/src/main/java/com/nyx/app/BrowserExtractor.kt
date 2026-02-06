package com.nyx.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * WebView-based stream extractor for Invidious /watch pages
 * Extracts ytInitialPlayerResponse via JavaScript injection
 */
object BrowserExtractor {
    private const val TAG = "BrowserExtractor"
    
    // Invidious instances (rotate on failure)
    private val INSTANCES = listOf(
        "https://invidious.nerdvpn.de",
        "https://inv.nadeko.net",
        "https://yewtu.be",
        "https://invidious.drgns.space",
        "https://iv.melmac.space",
        "https://vid.puffyan.us"
    )
    
    private var webView: WebView? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val initDeferred = CompletableDeferred<Unit>()
    
    // Request isolation (prevents race conditions)
    @Volatile
    private var currentRequestId: String? = null
    
    /**
     * Extract stream URL using WebView-based browser simulation
     * Thread-safe with proper initialization sync
     */
    suspend fun extractStreamUrl(videoId: String, context: Context): String {
        ensureInitialized(context)
        
        var lastError: Exception? = null
        
        for (instance in INSTANCES) {
            try {
                val watchUrl = "$instance/watch?v=$videoId"
                Log.i(TAG, "Loading: $watchUrl")
                
                // Timeout protection (8 seconds - faster failover)
                val playerData = withTimeout(8_000) {
                    loadAndExtract(watchUrl)
                }
                
                val streamUrl = parseStreamUrl(playerData)
                
                Log.i(TAG, "✓ Extracted stream URL")
                return streamUrl
                
            } catch (e: TimeoutCancellationException) {
                Log.w(TAG, "Timeout: $instance")
                lastError = Exception("Extraction timeout", e)
            } catch (e: Exception) {
                Log.w(TAG, "Instance failed: $instance → ${e.message}")
                lastError = e
            }
        }
        
        throw Exception("All instances failed", lastError)
    }
    
    /**
     * Ensure WebView is initialized (thread-safe with CompletableDeferred)
     */
    private suspend fun ensureInitialized(context: Context) {
        if (!initDeferred.isCompleted) {
            // First call - trigger initialization
            mainHandler.post {
                try {
                    createWebView(context.applicationContext)
                    initDeferred.complete(Unit)
                } catch (e: Exception) {
                    initDeferred.completeExceptionally(e)
                }
            }
        }
        
        // Wait for initialization to complete (no sleep, proper sync)
        initDeferred.await()
    }
    
    /**
     * Create hidden WebView on main thread
     */
    private fun createWebView(context: Context) {
        webView = WebView(context).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                
                // Mobile UA (matches playback engine for consistency)
                userAgentString = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                
                // Performance optimizations
                cacheMode = WebSettings.LOAD_NO_CACHE
                blockNetworkImage = true // Don't load images (we only need JS/HTML)
            }
            
            // WebChromeClient required for JS console and proper execution
            webChromeClient = WebChromeClient()
        }
        
        Log.i(TAG, "✓ WebView initialized")
    }
    
    /**
     * Load page and extract stream URL by intercepting network traffic
     */
    private suspend fun loadAndExtract(url: String): String = suspendCancellableCoroutine { cont ->
        val requestId = UUID.randomUUID().toString()
        currentRequestId = requestId
        
        mainHandler.post {
            val wv = webView
            if (wv == null) {
                cont.resumeWithException(Exception("WebView not initialized"))
                return@post
            }
            
            wv.webViewClient = object : WebViewClient() {
                private var resumed = false
                
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val reqUrl = request?.url?.toString() ?: return null
                    
                    // Check for audio/video stream URL or Invidious download API
                    if ((reqUrl.contains("googlevideo.com") || 
                         reqUrl.contains("/videoplayback") || 
                         reqUrl.contains("latest_version")) && !resumed) {
                        Log.i(TAG, "⚡ Intercepted stream URL: $reqUrl")
                        
                        if (requestId == currentRequestId) {
                            resumed = true
                            cont.resume(reqUrl) // Resume with the direct stream URL
                            
                            // Return empty response to block consumption in this WebView
                            return WebResourceResponse("text/plain", "utf-8", null)
                        }
                    }
                    
                    return super.shouldInterceptRequest(view, request)
                }
                
                override fun onPageFinished(view: WebView?, url: String?) {
                    // Force playback to trigger network request if not auto-started
                    wv.evaluateJavascript("document.querySelector('video')?.play();", null)
                }
                
                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    // Ignore, we might cause errors by blocking requests
                }
            }
            
            // Load the page with local=false (prefer direct links) and autoplay
            val captureUrl = if (url.contains("?")) "$url&local=false&autoplay=1" else "$url?local=false&autoplay=1"
            wv.loadUrl(captureUrl)
        }
        
        // Cancel support
        cont.invokeOnCancellation {
            mainHandler.post {
                if (requestId == currentRequestId) {
                    webView?.stopLoading()
                    currentRequestId = null
                }
            }
        }
    }
    
    /**
     * No parsing needed - we get raw URL
     */
    private fun parseStreamUrl(rawUrl: String): String {
        return rawUrl
    }
}

