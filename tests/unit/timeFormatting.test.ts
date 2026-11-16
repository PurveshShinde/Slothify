import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Replicates and validates the exact time and duration formatting implementations
 * used across Player.tsx, History.tsx, AlbumDetail.tsx, and PlaylistDetail.tsx.
 */

// Player.tsx implementation (seconds -> MM:SS)
function formatPlayerTime(time: number): string {
  if (isNaN(time) || time < 0) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// History.tsx & AlbumDetail.tsx implementation (ms -> MM:SS with default '3:00')
function formatHistoryDuration(ms?: number): string {
  if (!ms) return '3:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// PlaylistDetail.tsx implementation (ms -> MM:SS with default '0:00')
function formatPlaylistDuration(ms: number): string {
  if (!ms) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

// History.tsx relative time formatting
function formatRelativeTime(isoString?: string, mockNow?: Date): string {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
  const now = mockNow || new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

describe('Time and Duration Formatting', () => {
  describe('Player Time Formatter (seconds)', () => {
    it('formats 0 seconds correctly', () => {
      assert.equal(formatPlayerTime(0), '0:00');
    });

    it('formats single-digit seconds with leading zero', () => {
      assert.equal(formatPlayerTime(5), '0:05');
      assert.equal(formatPlayerTime(65), '1:05');
    });

    it('formats standard song durations', () => {
      assert.equal(formatPlayerTime(215), '3:35');
      assert.equal(formatPlayerTime(300), '5:00');
    });

    it('handles long tracks (over 1 hour)', () => {
      assert.equal(formatPlayerTime(3665), '61:05');
    });

    it('handles NaN and negative values safely', () => {
      assert.equal(formatPlayerTime(NaN), '0:00');
      assert.equal(formatPlayerTime(-10), '0:00');
    });
  });

  describe('Duration Formatters (milliseconds)', () => {
    it('formats track duration from milliseconds', () => {
      assert.equal(formatHistoryDuration(185000), '3:05');
      assert.equal(formatPlaylistDuration(185000), '3:05');
    });

    it('handles zero or undefined ms with respective defaults', () => {
      assert.equal(formatHistoryDuration(undefined), '3:00');
      assert.equal(formatHistoryDuration(0), '3:00');
      assert.equal(formatPlaylistDuration(0), '0:00');
    });
  });

  describe('Relative Time Formatter', () => {
    const fixedNow = new Date('2026-11-08T18:00:00.000Z');

    it('returns "Recently" for missing ISO string', () => {
      assert.equal(formatRelativeTime(undefined), 'Recently');
    });

    it('returns "Just now" for events under 60 seconds ago', () => {
      const past = new Date(fixedNow.getTime() - 30 * 1000).toISOString();
      assert.equal(formatRelativeTime(past, fixedNow), 'Just now');
    });

    it('returns minutes ago for events under 60 minutes ago', () => {
      const past = new Date(fixedNow.getTime() - 15 * 60 * 1000).toISOString();
      assert.equal(formatRelativeTime(past, fixedNow), '15m ago');
    });

    it('returns hours ago for events under 24 hours ago', () => {
      const past = new Date(fixedNow.getTime() - 4 * 3600 * 1000).toISOString();
      assert.equal(formatRelativeTime(past, fixedNow), '4h ago');
    });

    it('returns "Yesterday" for events between 24 and 48 hours ago', () => {
      const past = new Date(fixedNow.getTime() - 30 * 3600 * 1000).toISOString();
      assert.equal(formatRelativeTime(past, fixedNow), 'Yesterday');
    });

    it('returns days ago for events within a week', () => {
      const past = new Date(fixedNow.getTime() - 4 * 86400 * 1000).toISOString();
      assert.equal(formatRelativeTime(past, fixedNow), '4d ago');
    });

    it('returns formatted date for events older than a week', () => {
      const past = new Date('2026-10-15T12:00:00.000Z').toISOString();
      assert.equal(formatRelativeTime(past, fixedNow), 'Oct 15');
    });
  });
});

