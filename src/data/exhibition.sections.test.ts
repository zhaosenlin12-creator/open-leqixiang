import { describe, expect, it } from 'vitest';
import { navigation, sectionOrder, sections } from './exhibition';

describe('exhibition sections', () => {
  it('keeps pricing separate from courses while hiding it from primary navigation', () => {
    expect(sectionOrder).not.toContain('pricing');
    expect(navigation.some((item) => item.id === 'pricing')).toBe(false);
    expect(sections.courses.items.some((item) => item.id.includes('price'))).toBe(false);
    expect(sections.pricing.items.every((item) => item.id.includes('price'))).toBe(true);
  });

  it('keeps enough student records to support a horizontally browsable reel', () => {
    expect(sections.students.items.length).toBeGreaterThan(8);
  });
});
