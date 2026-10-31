import { describe, expect, it } from 'vitest';
import {
  createTourState,
  goToNextTourStep,
  goToPreviousTourStep,
  setTourPlaying
} from './tour';
import type { Tour } from '../types/content';

const tour: Tour = {
  id: 'quick',
  title: '3分钟快速介绍',
  estimatedMinutes: 3,
  enabled: true,
  nodes: [
    { id: 'brand', type: 'brand', title: '乐启享是谁', duration: 20 },
    { id: 'courses', type: 'courses', title: '课程路径', duration: 25 },
    { id: 'contact', type: 'contact', title: '预约咨询', duration: 15 }
  ]
};

describe('tour engine', () => {
  it('starts at the first node and plays by default', () => {
    const state = createTourState(tour);

    expect(state.currentNode.id).toBe('brand');
    expect(state.currentIndex).toBe(0);
    expect(state.isPlaying).toBe(true);
    expect(state.isComplete).toBe(false);
  });

  it('moves forward and marks completion at the end', () => {
    const first = createTourState(tour);
    const second = goToNextTourStep(first);
    const third = goToNextTourStep(second);
    const complete = goToNextTourStep(third);

    expect(second.currentNode.id).toBe('courses');
    expect(third.currentNode.id).toBe('contact');
    expect(complete.currentNode.id).toBe('contact');
    expect(complete.isComplete).toBe(true);
  });

  it('moves backward without going before the first node', () => {
    const state = goToPreviousTourStep(goToNextTourStep(createTourState(tour)));
    const firstAgain = goToPreviousTourStep(state);

    expect(state.currentNode.id).toBe('brand');
    expect(firstAgain.currentNode.id).toBe('brand');
  });

  it('can pause and resume', () => {
    const paused = setTourPlaying(createTourState(tour), false);
    const resumed = setTourPlaying(paused, true);

    expect(paused.isPlaying).toBe(false);
    expect(resumed.isPlaying).toBe(true);
  });
});

