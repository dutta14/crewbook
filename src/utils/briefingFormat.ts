const NOON_HOUR = 12;
const EVENING_HOUR = 18;

export function getGreeting(now: Date): string {
  const hour = now.getHours();
  if (hour < NOON_HOUR) return 'Good morning';
  if (hour < EVENING_HOUR) return 'Good afternoon';
  return 'Good evening';
}

/** "Tuesday, January 14, 2025" in local time. */
export function formatBriefingDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
