import { describe, expect, it } from 'vitest';
import { nextIndex, relativeOrbitSlot, wrapIndex } from './exhibition';

describe('exhibition navigation', () => {
  it('wraps indexes in both directions', () => {
    expect(wrapIndex(-1, 5)).toBe(4);
    expect(wrapIndex(5, 5)).toBe(0);
    expect(wrapIndex(7, 5)).toBe(2);
  });

  it('moves by a delta and wraps at the ends', () => {
    expect(nextIndex(4, 5)).toBe(0);
    expect(nextIndex(0, 5, -1)).toBe(4);
    expect(nextIndex(1, 5, 2)).toBe(3);
  });

  it('chooses the shortest signed slot around an orbit', () => {
    expect(relativeOrbitSlot(0, 0, 5)).toBe(0);
    expect(relativeOrbitSlot(1, 0, 5)).toBe(1);
    expect(relativeOrbitSlot(4, 0, 5)).toBe(-1);
    expect(relativeOrbitSlot(0, 4, 5)).toBe(1);
  });

  it('rejects empty collections', () => {
    expect(() => wrapIndex(0, 0)).toThrow('length must be greater than zero');
  });
});
