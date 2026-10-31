import type { PlaylistItem } from '../types/content';

export function getActivePlaylistItems(items: PlaylistItem[], now = new Date()): PlaylistItem[] {
  return items.filter((item) => {
    if (!item.enabled) return false;
    if (item.startsAt && new Date(item.startsAt) > now) return false;
    if (item.expiresAt && new Date(item.expiresAt) < now) return false;
    return true;
  });
}

export function getPlaylistItemDuration(item: PlaylistItem, defaultSeconds: number): number {
  return item.duration ?? defaultSeconds;
}

export function getNextPlaylistItem(items: PlaylistItem[], currentIndex: number): PlaylistItem {
  if (items.length === 0) {
    throw new Error('Cannot select a playlist item from an empty playlist');
  }
  return items[(currentIndex + 1) % items.length];
}

