import { describe, expect, it } from 'vitest';
import {
  getEnabledModules,
  isDisplayableAsset,
  normalizeContentBundle
} from './content';
import type { ContentBundle } from '../types/content';

const bundle: ContentBundle = {
  site: {
    name: '乐启享',
    tagline: '乐创未来 启享编程',
    contact: { phone: '18164173640', address: '宜昌市' },
    settings: { idleSeconds: 60, defaultSlideSeconds: 12 }
  },
  modules: [
    { id: 'courses', title: '课程体系', enabled: true, order: 2, summary: '3-16岁课程路径' },
    { id: 'staff', title: '师资团队', enabled: false, order: 3, summary: '师资能力' },
    { id: 'strength', title: '机构实力', enabled: true, order: 1, summary: '专业体系' }
  ],
  courses: { stages: [], routes: [] },
  tours: [],
  playlists: [],
  pricing: { public: { highlights: [] }, advisor: { assets: [] } },
  achievements: { competitions: [], showcases: [] },
  students: { policy: 'manual-review', showcases: [] },
  staff: { mode: 'capability-template', capabilities: [] },
  assets: [
    {
      id: 'logo',
      title: 'Logo',
      type: 'image',
      source: 'website',
      path: '/images/brand/logo.png',
      displayable: true
    },
    {
      id: 'student-private',
      title: '未审核学员图',
      type: 'image',
      source: 'student-archive',
      path: '/images/students/raw.jpg',
      displayable: false,
      privacy: 'unreviewed'
    }
  ]
};

describe('content normalization', () => {
  it('sorts enabled modules by order', () => {
    const normalized = normalizeContentBundle(bundle);

    expect(getEnabledModules(normalized).map((module) => module.id)).toEqual([
      'strength',
      'courses'
    ]);
  });

  it('preserves safe defaults when optional arrays are missing', () => {
    const normalized = normalizeContentBundle({
      ...bundle,
      tours: undefined,
      playlists: undefined
    });

    expect(normalized.tours).toEqual([]);
    expect(normalized.playlists).toEqual([]);
  });

  it('only displays reviewed or public assets', () => {
    const normalized = normalizeContentBundle(bundle);

    expect(isDisplayableAsset(normalized.assets[0])).toBe(true);
    expect(isDisplayableAsset(normalized.assets[1])).toBe(false);
  });
});

