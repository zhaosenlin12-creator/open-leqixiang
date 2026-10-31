import { describe, expect, it } from 'vitest';
import {
  getActivePlaylistItems,
  getNextPlaylistItem,
  getPlaylistItemDuration
} from './playlist';
import type { PlaylistItem } from '../types/content';

const items: PlaylistItem[] = [
  { id: 'hero', type: 'image', title: '活动海报', assetId: 'poster', enabled: true, duration: 8 },
  { id: 'disabled', type: 'image', title: '关闭素材', assetId: 'off', enabled: false },
  {
    id: 'expired',
    type: 'announcement',
    title: '过期公告',
    enabled: true,
    expiresAt: '2026-01-01'
  },
  { id: 'course', type: 'course', title: '课程体系', refId: 'courses', enabled: true }
];

describe('playlist engine', () => {
  it('filters disabled and expired items', () => {
    const active = getActivePlaylistItems(items, new Date('2026-06-17T12:00:00+08:00'));

    expect(active.map((item) => item.id)).toEqual(['hero', 'course']);
  });

  it('uses explicit duration or default duration', () => {
    expect(getPlaylistItemDuration(items[0], 12)).toBe(8);
    expect(getPlaylistItemDuration(items[3], 12)).toBe(12);
  });

  it('wraps to the first active item after the last one', () => {
    const active = getActivePlaylistItems(items, new Date('2026-06-17T12:00:00+08:00'));
    const next = getNextPlaylistItem(active, 1);

    expect(next.id).toBe('hero');
  });
});

