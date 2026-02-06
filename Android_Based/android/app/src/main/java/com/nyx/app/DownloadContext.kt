package com.nyx.app

/**
 * Context for a download request, defining structure and metadata
 */
data class DownloadContext(
    val videoId: String,
    val title: String,
    val artist: String,
    val isPlaylist: Boolean = false,
    val playlistId: String? = null,
    val playlistName: String? = null
)
