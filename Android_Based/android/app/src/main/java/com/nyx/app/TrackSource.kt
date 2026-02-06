package com.nyx.app

import java.io.File

/**
 * source type enum
 */
enum class SourceType {
    ONLINE,
    OFFLINE
}

/**
 * Canonical source for playback requests
 */
data class TrackSource(
    val videoId: String,
    val source: SourceType,
    val localFile: File? = null,
    val metadata: Map<String, String>? = null
)
