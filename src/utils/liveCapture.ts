import type { CaptureType } from '../types/LiveSession';

export const CAPTURE_TITLE_MAX_LENGTH = 200;

export const CAPTURE_LABELS: Record<CaptureType, string> = {
  action: 'Action item',
  decision: 'Decision',
  followup: 'Follow-up',
};

/** One line of text: runs of whitespace, including line breaks, become a single space. */
export function cleanCaptureTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

/** Adds the capture as a markdown bullet at the end of the notes, on a line of its own. */
export function appendCapture(content: string, type: CaptureType, title: string): string {
  const line = `- **${CAPTURE_LABELS[type]}:** ${title}`;
  if (content.trim().length === 0) return line;
  const body = content.replace(/\s+$/, '');
  const lastLine = body.slice(body.lastIndexOf('\n') + 1);
  // Consecutive captures stay in one tight list.
  const gap = lastLine.startsWith('- **') ? '\n' : '\n\n';
  return `${body}${gap}${line}`;
}
