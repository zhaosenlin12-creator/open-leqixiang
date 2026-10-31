export type AssetSource = 'website' | 'pdf' | 'student-archive' | 'generated' | 'manual';
export type AssetType = 'image' | 'video' | 'document' | 'page';

export interface SiteConfig {
  name: string;
  tagline: string;
  contact: {
    phone: string;
    address: string;
    qrCode?: string;
  };
  settings: {
    idleSeconds: number;
    defaultSlideSeconds: number;
  };
}

export interface DisplayModule {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
  summary: string;
  coverAssetId?: string;
}

export interface CourseStage {
  id: string;
  name: string;
  ageRange: string;
  tagline: string;
  description: string;
  highlights: string[];
  color?: string;
  stageOutput?: string;
}

export interface CourseRoute {
  id: string;
  name: string;
  description: string;
  path: string[];
}

export interface CoursesConfig {
  stages: CourseStage[];
  routes: CourseRoute[];
}

export interface TourNode {
  id: string;
  type: string;
  title: string;
  duration: number;
  refId?: string;
  assetId?: string;
  body?: string;
}

export interface Tour {
  id: string;
  title: string;
  estimatedMinutes: number;
  enabled: boolean;
  nodes: TourNode[];
}

export interface PlaylistItem {
  id: string;
  type: 'image' | 'video' | 'announcement' | 'course' | 'tour' | 'pricing' | 'module';
  title: string;
  enabled: boolean;
  duration?: number;
  assetId?: string;
  refId?: string;
  startsAt?: string;
  expiresAt?: string;
  muted?: boolean;
}

export interface PricingConfig {
  public: {
    range?: string;
    highlights: string[];
  };
  advisor: {
    assets: string[];
  };
}

export interface AchievementsConfig {
  competitions: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
  showcases: Array<{
    id: string;
    title: string;
    assetId?: string;
    summary: string;
  }>;
}

export interface StudentsConfig {
  policy: 'manual-review';
  showcases: Array<{
    id: string;
    title: string;
    assetId: string;
    summary: string;
  }>;
}

export interface StaffConfig {
  mode: 'capability-template' | 'real-profiles';
  capabilities: string[];
}

export interface DisplayAsset {
  id: string;
  title: string;
  type: AssetType;
  source: AssetSource;
  path: string;
  displayable: boolean;
  privacy?: 'public' | 'unreviewed' | 'restricted';
  tags?: string[];
}

export interface ContentBundle {
  site: SiteConfig;
  modules: DisplayModule[];
  courses: CoursesConfig;
  tours?: Tour[];
  playlists?: PlaylistItem[];
  pricing: PricingConfig;
  achievements: AchievementsConfig;
  students: StudentsConfig;
  staff: StaffConfig;
  assets: DisplayAsset[];
}

export interface NormalizedContentBundle extends Omit<ContentBundle, 'tours' | 'playlists'> {
  tours: Tour[];
  playlists: PlaylistItem[];
}

