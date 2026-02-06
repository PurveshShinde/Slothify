package com.nyx.app

/**
 * Single Source of Truth for Playback State
 * Aggregates state from WebView (Streaming) or ExoPlayer (Offline)
 */
data class PlaybackStateSnapshot(
    val isPlaying: Boolean,
    val positionMs: Long,
    val durationMs: Long,
    val title: String,
    val artist: String,
    val videoId: String,
    val artworkUrl: String? = null
)
