import type {
  ContentBundle,
  DisplayAsset,
  DisplayModule,
  NormalizedContentBundle
} from '../types/content';

export function normalizeContentBundle(bundle: ContentBundle): NormalizedContentBundle {
  return {
    ...bundle,
    tours: bundle.tours ?? [],
    playlists: bundle.playlists ?? []
  };
}

export function getEnabledModules(bundle: NormalizedContentBundle): DisplayModule[] {
  return bundle.modules
    .filter((module) => module.enabled)
    .sort((a, b) => a.order - b.order);
}

export function isDisplayableAsset(asset: DisplayAsset): boolean {
  if (!asset.displayable) return false;
  if (asset.privacy === 'unreviewed' || asset.privacy === 'restricted') return false;
  return true;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loadContentBundle(basePath = '/content'): Promise<NormalizedContentBundle> {
  const [
    site,
    modules,
    courses,
    tours,
    playlists,
    pricing,
    achievements,
    students,
    staff,
    assets
  ] = await Promise.all([
    fetchJson<ContentBundle['site']>(`${basePath}/site.json`),
    fetchJson<ContentBundle['modules']>(`${basePath}/modules.json`),
    fetchJson<ContentBundle['courses']>(`${basePath}/courses.json`),
    fetchJson<NonNullable<ContentBundle['tours']>>(`${basePath}/tours.json`),
    fetchJson<NonNullable<ContentBundle['playlists']>>(`${basePath}/playlists.json`),
    fetchJson<ContentBundle['pricing']>(`${basePath}/pricing.json`),
    fetchJson<ContentBundle['achievements']>(`${basePath}/achievements.json`),
    fetchJson<ContentBundle['students']>(`${basePath}/students.json`),
    fetchJson<ContentBundle['staff']>(`${basePath}/staff.json`),
    fetchJson<ContentBundle['assets']>(`${basePath}/assets.json`)
  ]);

  return normalizeContentBundle({
    site,
    modules,
    courses,
    tours,
    playlists,
    pricing,
    achievements,
    students,
    staff,
    assets
  });
}

