import type { Tour, TourNode } from '../types/content';

export interface TourState {
  tour: Tour;
  currentIndex: number;
  currentNode: TourNode;
  isPlaying: boolean;
  isComplete: boolean;
}

export function createTourState(tour: Tour): TourState {
  if (tour.nodes.length === 0) {
    throw new Error(`Tour "${tour.id}" has no nodes`);
  }

  return {
    tour,
    currentIndex: 0,
    currentNode: tour.nodes[0],
    isPlaying: true,
    isComplete: false
  };
}

export function goToNextTourStep(state: TourState): TourState {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.tour.nodes.length) {
    return {
      ...state,
      isComplete: true,
      isPlaying: false
    };
  }

  return {
    ...state,
    currentIndex: nextIndex,
    currentNode: state.tour.nodes[nextIndex],
    isComplete: false
  };
}

export function goToPreviousTourStep(state: TourState): TourState {
  const previousIndex = Math.max(0, state.currentIndex - 1);
  return {
    ...state,
    currentIndex: previousIndex,
    currentNode: state.tour.nodes[previousIndex],
    isComplete: false
  };
}

export function setTourPlaying(state: TourState, isPlaying: boolean): TourState {
  return {
    ...state,
    isPlaying,
    isComplete: isPlaying ? false : state.isComplete
  };
}

