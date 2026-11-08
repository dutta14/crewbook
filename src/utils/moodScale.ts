import type { MoodScore } from '../types/MoodEntry';

export const MOOD_SCORES: readonly MoodScore[] = [1, 2, 3, 4, 5];

export const MOOD_LABELS: Record<MoodScore, { emoji: string; label: string }> = {
  1: { emoji: '😟', label: 'Very low energy' },
  2: { emoji: '😕', label: 'Low energy' },
  3: { emoji: '😐', label: 'Neutral' },
  4: { emoji: '🙂', label: 'Good energy' },
  5: { emoji: '😊', label: 'Great energy' },
};

export function isMoodScore(value: unknown): value is MoodScore {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}
