# Regression Test Plan & Feature Protection Matrix
**Slothify Music Streaming Platform**  
**Phase 0 Baseline Documentation**  

---

## 1. Feature Verification Matrix

| Major Feature Area | Verification Type | Automated Test Coverage | Manual Verification Required |
| :--- | :---: | :--- | :--- |
| **Authentication (Zero-Friction)** | Hybrid | `authBusinessLogic.test.ts` (JWT, regex, passkey) | Browser test: 12-word passkey download, registration, login, logout, account recovery modal flow. |
| **Zero-Knowledge Encryption** | Automated | `cryptoCompatibility.test.ts` (Round-trip, candidate secrets, tampering) | Browser test: Verify existing MongoDB Atlas playlists and liked songs appear and decrypt on login. |
| **Audio Routing & Fallback** | Hybrid | `similarityMatching.test.ts` (Saavn fuzzy query, YouTube fuzzy match) | Browser test: Play track via JioSaavn; play track via YouTube; test fallback on region-locked track. |
| **Player Scrubbing & Seeking** | Hybrid | `timeFormatting.test.ts` (Seconds & ms formatters) | Browser test: Drag seek bar on desktop bar, mobile downbar, and vintage turntable; confirm 0 seek snapping. |
| **Vintage Turntable & Waveform** | Manual | N/A (Canvas rendering, CSS `@keyframes` rotation) | Browser test: Disc spins on play, freezes on pause without angle reset; animated waveform pulses; tonearm tracks. |
| **Desktop / Mobile Player Transitions**| Manual | N/A (Framer Motion `layoutId` morphing & touch gestures) | Browser test: Expand desktop player to 2-column layout; swipe-down dismiss on mobile (> 75px) collapses into downbar. |
| **Track Relevance & Search Ranking** | Automated | `trackDeduplication.test.ts` (Index 0 hit bonus, knockoff spam penalty) | Browser test: Search "Shape of You", "Sahiba", "Favorite"; verify canonical original hit ranks #1 with 640x640 art. |
| **Album Cover Consistency** | Hybrid | `imageOptimizer.test.ts` (CDN upgrade, fallback avatars) | Browser test: Open album from `/albums`; verify poster never flickers, mutates, or changes after `/api/albums/:id` loads. |
| **Spotify Playlist Importer** | Hybrid | `playlistAndHistoryLogic.test.ts` (Envelope parsing & custom sorting) | Browser test: Paste public Spotify playlist URL; verify 200+ songs import into local session; verify custom sequence. |
| **Playlist CRUD & Reordering** | Hybrid | `playlistAndHistoryLogic.test.ts` (Sorting, deduplication) | Browser test: Create playlist, add track, remove track, delete playlist (verify no ghost entries in localStorage). |
| **Liked Songs Collection** | Hybrid | `cryptoCompatibility.test.ts` (Liked track encryption) | Browser test: Heart track in Player, Home, Album, Artist views; verify heart toggles across all open components. |
| **Listening History & Personalization** | Hybrid | `playlistAndHistoryLogic.test.ts` (Deduplication, 100-cap) | Browser test: Play 3 tracks; check `/history`; verify top played artists surface in Home recommendations. |
| **Dual Theme Switching** | Manual | N/A (CSS variables, dual-layer GPU wallpaper cross-fade) | Browser test: Toggle Ocean and Autumn in sidebar/settings; verify smooth zoom in/out and contrast legibility. |
| **User Settings & Local Avatars** | Manual | N/A (LocalStorage file upload, audio engine selection) | Browser test: Change avatar via avatar picker modal; toggle audio provider; clear browser cache. |
| **Responsive Shell & Navigation** | Manual | N/A (Desktop sidebar vs mobile bottom nav) | Browser test: Resize viewport (< 768px vs >= 768px); verify 0 horizontal overflow and 0 visual clipping. |

---

## 2. Step-by-Step Manual Browser Test Protocols

### Protocol A: Multi-Source Audio Playback & Seeking Integrity
1. Open Slothify in Google Chrome (Desktop viewport: 1440x900).
2. Click the Play button on the Home hero track.
3. **Verify:**
   - Audio begins playing immediately (< 1.5s).
   - Desktop bottom media bar renders track title, artist, play/pause state, and volume slider.
4. Click anywhere on the bottom desktop media bar (except individual buttons).
5. **Verify:**
   - Full-screen player expands with Framer Motion spring physics.
   - Widescreen 2-column layout activates: spinning vinyl platter on the LEFT, playback controls & lyrics/queue on the RIGHT.
6. Click and drag the progress scrubber to `1:30`. Release.
7. **Verify:**
   - Playback buffers and resumes at exactly `1:30`.
   - The scrubber slider does NOT snap back to `0:05` or hitch during the seek operation.
8. Switch viewport to Mobile emulation (iPhone 14, 390x844).
9. **Verify:**
   - Player adapts to single-column vertical stack with Normal/Vintage segmented toggle.
   - Drag down from the top handle (> 75px).
   - Player collapses smoothly into the floating downbar positioned above the bottom tab navigation.

### Protocol B: Zero-Knowledge Account Creation & Recovery
1. Open the Sign In modal from the top-right header or sidebar.
2. Select the "Create Account" tab.
3. Enter a 5-letter test username (`tester_01`) and password.
4. Check both required checkboxes (fun agreement + terms). Click "Create Account".
5. **Verify:**
   - A unique 12-word recovery passphrase modal is presented.
   - Click "Download Key (.txt)"; verify file downloads to disk containing the exact 12 words.
   - Click "I Saved My Key"; verify user profile loads with DiceBear Bottts avatar.
6. Like 2 tracks and create a playlist named "Offline Test".
7. Log out.
8. Click "Sign In" -> "Forgot Password / Account Recovery".
9. Enter `tester_01`, paste the 12-word passkey, and set a new password. Click "Reset Password & Login".
10. **Verify:**
    - Login succeeds with new credentials.
    - Previously created playlist "Offline Test" and 2 liked songs decrypt and render with correct metadata.

### Protocol C: Search Ranking & Poster Consistency
1. Navigate to `/search`.
2. Type `"Shape of You"`.
3. **Verify:**
   - Search results update within 300ms (debounced).
   - Ed Sheeran's canonical studio master hit from `÷ (Deluxe)` ranks #1.
   - Workout, fitness, nightcore, and knockoff acoustic covers are suppressed from the top 5 results.
   - Album artwork renders high-resolution 640x640 CDN image.
4. Navigate to `/albums` and click the first album card.
5. **Verify:**
   - Album detail page opens instantly.
   - The album poster cover matches the card cover and **does not flicker or mutate** when the tracklist finishes loading.

### Protocol D: Spotify Playlist Import & Deletion
1. Open the Spotify Import modal (via Library "+ Import Playlist" button).
2. Paste public link: `https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M`.
3. Click "Import".
4. **Verify:**
   - Modal displays sync progress.
   - Playlist appears in Library under the Spotify section with Spotify green badge.
   - Original custom Spotify track sequence is preserved.
5. Click the trash icon to delete the playlist and confirm deletion.
6. **Verify:**
   - Playlist is removed immediately from Library, Sidebar, and CacheContext.
   - Refreshing the page does NOT restore a ghost playlist from `localStorage`.

---

## 3. Strict Verification Guidelines

> [!IMPORTANT]
> **No feature may be marked as "verified" solely based on automated unit tests.**
> Automated tests cover deterministic data transformations, cryptographic algorithms, query string sanitization, and parsing logic. 
> Visual animations, audio codec decoding, MediaSession lock screen controls, and layout transitions **must be confirmed via Manual Browser Protocols A–D**.

