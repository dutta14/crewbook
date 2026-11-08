/** "Tue, Jan 7, 2026 · 10:00 AM" in the viewer's time zone. Returns "" for an invalid date. */
export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  // Built by hand: some ICU versions put a narrow no-break space before AM/PM.
  return `${day} · ${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
