export function wrapIndex(index: number, length: number): number {
  if (length <= 0) {
    throw new Error('length must be greater than zero');
  }

  return ((index % length) + length) % length;
}

export function nextIndex(index: number, length: number, delta = 1): number {
  return wrapIndex(index + delta, length);
}

export function relativeOrbitSlot(index: number, activeIndex: number, length: number): number {
  const forwardDistance = wrapIndex(index - activeIndex, length);
  return forwardDistance > length / 2 ? forwardDistance - length : forwardDistance;
}
