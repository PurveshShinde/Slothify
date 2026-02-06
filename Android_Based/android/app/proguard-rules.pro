# ===== YoutubeDL Android Native Library Protection =====
# Keep all YoutubeDL classes (JNI loaders)
-keep class com.yausername.youtubedl_android.** { *; }

# Keep native method declarations
-keepclasseswithmembernames class * {
    native <methods>;
}

# Prevent R8 from removing static initializers that load native libs
-keepclassmembers class * {
    static <fields>;
    static <methods>;
}

# Don't obfuscate YoutubeDL exceptions
-keep class com.yausername.youtubedl_android.YoutubeDLException

# Keep reflection access
-keepattributes *Annotation*
-keepattributes Signature

# ===== Apache Commons Compress (CRITICAL - Used by yt-dlp to unzip Python) =====
-keep class org.apache.commons.compress.** { *; }
-dontwarn org.apache.commons.compress.**

# ===== Media3 / ExoPlayer =====
-dontwarn androidx.media3.**
