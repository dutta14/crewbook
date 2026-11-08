import { describe, expect, it } from 'vitest';
import { appendCapture, cleanCaptureTitle } from './liveCapture';

describe('cleanCaptureTitle', () => {
  it('collapses whitespace and line breaks into single spaces', () => {
    expect(cleanCaptureTitle('  Ship \n the   doc  ')).toBe('Ship the doc');
  });
});

describe('appendCapture', () => {
  it('starts the notes with the line when they are empty', () => {
    expect(appendCapture('  \n', 'decision', 'Move to Tuesdays')).toBe(
      '- **Decision:** Move to Tuesdays',
    );
  });

  it('puts a blank line between prose and the capture', () => {
    expect(appendCapture('We talked.\n', 'action', 'Send the doc')).toBe(
      'We talked.\n\n- **Action item:** Send the doc',
    );
  });

  it('keeps consecutive captures in one list', () => {
    const first = appendCapture('We talked.', 'followup', 'Check in Friday');

    expect(appendCapture(first, 'decision', 'Ship it')).toBe(
      'We talked.\n\n- **Follow-up:** Check in Friday\n- **Decision:** Ship it',
    );
  });
});
