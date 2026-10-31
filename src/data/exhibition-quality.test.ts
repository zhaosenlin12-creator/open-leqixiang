import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { heroSlides, navigation, sections } from './exhibition';

const mojibakePattern = /[�]|(?:涓|鍚|绛|璇|鎴|瀛|甯|鏈|棣|鐪|鏁|涔|瑙|鍏|閫|鐢|灞|妯|寮|搴|浠|绉|璺|鑽|浜|鏃|鍦|鐨|鐜|彂|熷|冨|姩|堕|滄|愬|栫|垮|€)/;

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((entry) => collectStrings(entry, out));
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectStrings(entry, out));
  }
  return out;
}

describe('exhibition content quality', () => {
  it('keeps visible exhibition copy free of mojibake', () => {
    const copy = collectStrings({ heroSlides, navigation, sections });
    const corrupted = copy.filter((text) => mojibakePattern.test(text));

    expect(corrupted).toEqual([]);
  });

  it('keeps component accessibility copy free of mojibake', () => {
    const componentFiles = [
      'src/components/ExhibitionHeader.tsx',
      'src/components/HeroCarousel.tsx',
      'src/components/LayeredDrawer.tsx',
      'src/components/OrbitGallery.tsx'
    ];

    const corrupted = componentFiles.flatMap((file) => {
      const content = readFileSync(join(process.cwd(), file), 'utf8');
      return content
        .split('\n')
        .map((line, index) => ({ file, line: index + 1, text: line }))
        .filter(({ text }) => mojibakePattern.test(text));
    });

    expect(corrupted).toEqual([]);
  });

  it('keeps the course material browser as an interactive horizontal reel', () => {
    const gallery = readFileSync(join(process.cwd(), 'src/components/OrbitGallery.tsx'), 'utf8');
    const detailLayer = readFileSync(join(process.cwd(), 'src/components/LayeredDrawer.tsx'), 'utf8');
    const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

    expect(gallery).toContain('handlePointerDown');
    expect(gallery).toContain('setPointerCapture');
    expect(styles).toContain('cursor: grab');
    expect(detailLayer).toContain('cinematic-view');
    expect(detailLayer).not.toContain('detail-drawer');
  });

  it('references only local media files that exist', () => {
    const mediaPaths = collectStrings({ heroSlides, sections })
      .filter((text) => text.startsWith('/images/'));

    const missing = mediaPaths.filter((assetPath) => {
      const filePath = join(process.cwd(), 'public', assetPath);
      return !existsSync(filePath);
    });

    expect(missing).toEqual([]);
  });
});
