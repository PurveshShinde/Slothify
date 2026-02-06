package com.nyx.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.DownloadManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.Context
import android.media.AudioManager
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import kotlinx.coroutines.*
import java.io.File
import android.os.Environment
import android.widget.Toast

/**
 * Step 8: Service using MediaSessionCompat for full state synchronization
 */
class NyxPlaybackService : Service() {

    private lateinit var engineController: PlaybackEngineController
    private lateinit var audioManager: AudioManager
    private lateinit var mediaSession: MediaSessionCompat
    
    private val TAG = "NyxPlaybackService"
    
    // Scope for downloads
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // Commands
    private val ACTION_TEST_PLAY = "com.nyx.app.TEST_PLAY"
    private val ACTION_TEST_QUEUE = "com.nyx.app.TEST_QUEUE"
    
    private var currentVideoId: String? = null
    private val binder = LocalBinder()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TEST_PLAY -> {
                val videoId = intent?.getStringExtra("videoId")
                if (videoId != null) {
                    Log.i(TAG, "🧪 TEST_PLAY received: $videoId")
                    loadTrack(videoId, "Test Title", "Test Artist", null)
                }
            }
            ACTION_TEST_QUEUE -> {
                val videoId = intent?.getStringExtra("videoId")
                if (videoId != null) {
                    Log.i(TAG, "🧪 TEST_QUEUE received: $videoId")
                    queueNextTrack(videoId, "Next Title", "Next Artist", null)
                }
            }
            "com.nyx.app.TEST_DOWNLOAD" -> {
                val videoId = intent?.getStringExtra("videoId")
                val title = intent?.getStringExtra("title") ?: "Test Audio"
                if (videoId != null) {
                    Log.i(TAG, "🧪 TEST_DOWNLOAD received: $videoId")
                    val metadata = mapOf("title" to title, "artist" to "Test Artist")
                    downloadTrack(videoId, metadata)
                }
            }
        }
        return START_NOT_STICKY
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "✓ Service created - Step 8: Sync Mode")
        
        // 1. Initialize MediaSession
        mediaSession = MediaSessionCompat(this, "NyxPlaybackService").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { resumePlayback() }
                override fun onPause() { pausePlayback() }
                override fun onStop() { stopPlayback() }
                override fun onSeekTo(pos: Long) { seekTo(pos) }
                override fun onSkipToNext() { 
                    // Logic to skip would go here if we tracked queue in service
                }
            })
            
            // Explicitly set the media button receiver (Compat fix)
            val mediaButtonIntent = Intent(Intent.ACTION_MEDIA_BUTTON)
            mediaButtonIntent.setClass(this@NyxPlaybackService, androidx.media.session.MediaButtonReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(this@NyxPlaybackService, 0, mediaButtonIntent, PendingIntent.FLAG_IMMUTABLE)
            setMediaButtonReceiver(pendingIntent)
            
            isActive = true
        }
        
        // 2. Initialize Engine Controller
        engineController = PlaybackEngineController(this, object : WebViewQueueManager.QueueCallback {
            override fun onPlaybackStarted(videoId: String) {
                Log.i(TAG, "✓ Playback started: $videoId")
                // Notification/Session updated via onStateUpdated
            }
            
            override fun onPlaybackPaused() {
                Log.i(TAG, "✓ Playback paused")
            }
            
            override fun onPlaybackEnded() {
                Log.i(TAG, "✓ Playback ended")
                updateNotification("Finished", "", false)
                updateMediaSessionState(false, 0, 1.0f)
                broadcastPlaybackEvent(PlaybackStateSnapshot(false, 0, 0, "", "", "", null))
            }
            
            override fun onError(message: String) {
                Log.e(TAG, "✗ Playback error: $message")
                updateNotification("Error", message, false)
            }
            
            override fun onStateUpdated(snapshot: PlaybackStateSnapshot) {
                // The Heartbeat of Step 8
                updateMediaSession(snapshot)
                updateNotification(snapshot)
                broadcastPlaybackEvent(snapshot)
            }
        })
        
        // 3. Request audio focus
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        val result = audioManager.requestAudioFocus(
            null,
            AudioManager.STREAM_MUSIC,
            AudioManager.AUDIOFOCUS_GAIN
        )
        
        if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            Log.i(TAG, "✓ Audio focus granted")
        } else {
            Log.w(TAG, "⚠ Audio focus denied")
        }
        
        // 4. Start Foreground (Initial)
        startForegroundNotification()
        
        // 5. Cleanup
        checkOrphanedDownloads()
        
        Log.i(TAG, "✓ Service initialized")
    }
    
    private fun updateMediaSession(snapshot: PlaybackStateSnapshot) {
        // Update Metadata
        val metadata = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, snapshot.title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, snapshot.artist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, snapshot.durationMs)
            // .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, snapshot.artworkUrl) // Need Bitmap for Lockscreen usually
            .build()
        mediaSession.setMetadata(metadata)
        
        // Update State
        updateMediaSessionState(snapshot.isPlaying, snapshot.positionMs, 1.0f)
    }

    private fun updateMediaSessionState(isPlaying: Boolean, position: Long, speed: Float) {
        val stateBuilder = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_SEEK_TO or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(
                if (isPlaying) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
                position,
                speed
            )
        mediaSession.setPlaybackState(stateBuilder.build())
    }

    private fun startForegroundNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows currently playing music"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        
        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Nyx Music")
            .setContentText("Ready to play")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(false) // Not ongoing when idle
            .build()
        
        startForeground(NOTIFICATION_ID, notification)
    }
    
    private fun updateNotification(snapshot: PlaybackStateSnapshot) {
        updateNotification(snapshot.title, snapshot.artist, snapshot.isPlaying)
    }
    
    private fun updateNotification(title: String, text: String, isPlaying: Boolean) {
        val playPauseAction = if (isPlaying) {
             NotificationCompat.Action(
                 android.R.drawable.ic_media_pause, "Pause",
                 androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                     this, PlaybackStateCompat.ACTION_PAUSE
                 )
             )
        } else {
             NotificationCompat.Action(
                 android.R.drawable.ic_media_play, "Play",
                 androidx.media.session.MediaButtonReceiver.buildMediaButtonPendingIntent(
                     this, PlaybackStateCompat.ACTION_PLAY
                 )
             )
        }

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0)
            )
            .addAction(playPauseAction)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(isPlaying)
            .build()
        
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }
    
    /**
     * Load and play track (Auto-Detect: Offline vs Online)
     */
    fun loadTrack(videoId: String, title: String?, artist: String?, artwork: String?, localPath: String? = null) {
        currentVideoId = videoId
        
        // Metadata defaults
        val safeTitle = title ?: "Unknown Title"
        val safeArtist = artist ?: "Unknown Artist"
        
        // 1. Check for offline file (Explicit path or Auto-Detect)
        val offlineFile = if (localPath != null) {
            val file = File(localPath)
            if (file.exists()) file else getOfflineFile(videoId)
        } else {
            getOfflineFile(videoId)
        }
        
        if (offlineFile != null && offlineFile.exists()) {
            Log.i(TAG, "📂 Offline file found for $videoId. Switching to Offline Engine.")
            engineController.playOffline(offlineFile, videoId, safeTitle, safeArtist, artwork)
        } else {
            // 2. Fallback to Streaming
             Log.i(TAG, "🌐 Streaming track: $videoId")
             updateNotification("Resolving stream...", safeTitle, false) // 3. UX Fallback State
             engineController.playStreaming(videoId, safeTitle, safeArtist, artwork)
        }
    }
    
    /**
     * Download track to local storage with metadata and atomic finalization
     */
    fun downloadTrack(videoId: String, metadata: Map<String, String>) {
        val title = metadata["title"] ?: "Unknown Title"
        val artist = metadata["artist"] ?: "Unknown Artist"
        val isPlaylist = metadata["isPlaylist"] == "true"
        val playlistId = metadata["playlistId"]
        
        val downloadContext = DownloadContext(
            videoId = videoId,
            title = title,
            artist = artist,
            isPlaylist = isPlaylist,
            playlistId = playlistId
        )
        
        serviceScope.launch(Dispatchers.IO) {
            try {
                Log.i(TAG, "Download requested: $title ($videoId)")
                DownloadHelper.writeMetadata(this@NyxPlaybackService, downloadContext, metadata)
                val streamUrl = BrowserExtractor.extractStreamUrl(videoId, this@NyxPlaybackService)
                val downloadId = DownloadHelper.downloadAudio(this@NyxPlaybackService, downloadContext, streamUrl)
                Log.i(TAG, "Download started for $videoId (ID: $downloadId)")
                monitorDownloadProgress(downloadId, downloadContext)
            } catch (e: Exception) {
                Log.e(TAG, "Download failed", e)
                broadcastDownloadEvent("failed", videoId, -1)
            }
        }
    }
    
    private suspend fun monitorDownloadProgress(downloadId: Long, downloadContext: DownloadContext) {
        val manager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        var isDownloading = true
        val videoId = downloadContext.videoId
        
        while (isDownloading && serviceScope.isActive) {
            val query = DownloadManager.Query().setFilterById(downloadId)
            val cursor = manager.query(query)
            
            if (cursor.moveToFirst()) {
                val statusCol = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                val totalSizeCol = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                val downloadedCol = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                val status = cursor.getInt(statusCol)
                
                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        isDownloading = false
                        if (DownloadHelper.finalizeDownload(this, downloadContext)) {
                             broadcastDownloadEvent("completed", videoId, 100)
                        } else {
                             broadcastDownloadEvent("failed", videoId, 0)
                        }
                    }
                    DownloadManager.STATUS_FAILED -> {
                        isDownloading = false
                        broadcastDownloadEvent("failed", videoId, 0)
                    }
                    DownloadManager.STATUS_RUNNING -> {
                        val total = cursor.getLong(totalSizeCol)
                        val downloaded = cursor.getLong(downloadedCol)
                        if (total > 0) {
                            val progress = ((downloaded * 100) / total).toInt()
                            broadcastDownloadEvent("progress", videoId, progress)
                        }
                    }
                }
            } else {
                isDownloading = false
            }
            cursor.close()
            if (isDownloading) delay(1000)
        }
    }
    
    private fun checkOrphanedDownloads() {
        serviceScope.launch(Dispatchers.IO) {
            val dir = getExternalFilesDir(Environment.DIRECTORY_MUSIC)
            val nyxDir = File(dir, "Nyx")
            if (nyxDir.exists()) {
                nyxDir.listFiles()?.forEach { file ->
                    if (file.name.endsWith(".partial")) {
                        file.delete()
                    }
                }
            }
        }
    }
    
    private fun broadcastDownloadEvent(type: String, videoId: String, progress: Int) {
        val intent = Intent("com.nyx.app.DOWNLOAD_EVENT")
        intent.putExtra("type", type)
        intent.putExtra("videoId", videoId)
        intent.putExtra("progress", progress)
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }
    
    private fun getOfflineFile(videoId: String): File? {
        val dir = getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: return null
        val smartFile = File(dir, "Nyx/Downloads/$videoId/audio.m4a")
        if (smartFile.exists()) return smartFile
        val legacyFile = File(dir, "Nyx/$videoId.m4a")
        if (legacyFile.exists()) return legacyFile
        return null
    }

    /**
     * Queue next track
     */
    fun queueNextTrack(videoId: String, title: String?, artist: String?, artwork: String?) {
        engineController.queueNext(videoId, title ?: "", artist ?: "", artwork)
    }
    
    fun pausePlayback() = engineController.pause()
    fun resumePlayback() = engineController.resume()
    fun stopPlayback() = engineController.stop()
    fun seekTo(pos: Long) = engineController.seekTo(pos)
    
    private fun broadcastPlaybackEvent(snapshot: PlaybackStateSnapshot) {
        val intent = Intent("com.nyx.app.PLAYBACK_EVENT")
        intent.putExtra("isPlaying", snapshot.isPlaying)
        intent.putExtra("position", snapshot.positionMs)
        intent.putExtra("duration", snapshot.durationMs)
        intent.putExtra("title", snapshot.title)
        intent.putExtra("artist", snapshot.artist)
        intent.putExtra("videoId", snapshot.videoId)
        androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }

    inner class LocalBinder : Binder() {
        fun getService(): NyxPlaybackService = this@NyxPlaybackService
        fun getMediaSessionToken(): MediaSessionCompat.Token = mediaSession.sessionToken
    }
    
    override fun onBind(intent: Intent?): IBinder {
        return binder
    }
    
    override fun onDestroy() {
        Log.i(TAG, "Service destroyed")
        mediaSession.isActive = false
        mediaSession.release()
        engineController.release()
        serviceScope.cancel()
        audioManager.abandonAudioFocus(null)
        super.onDestroy()
    }
    
    companion object {
        private const val NOTIFICATION_CHANNEL_ID = "nyx_playback"
        private const val NOTIFICATION_ID = 1
    }
}
