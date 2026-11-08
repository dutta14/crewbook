export type CaptureType = 'action' | 'decision' | 'followup';

export interface QuickCaptureItem {
  id: string;
  type: CaptureType;
  title: string;
  /** ISO 8601. Held in memory only; the saved note carries no per-item timestamps. */
  createdAt: string;
}

export interface LiveSession {
  memberId: string;
  /** Running notes markdown, including a line for each quick capture. */
  content: string;
  captures: QuickCaptureItem[];
  /** ISO 8601 */
  startedAt: string;
  endedAt?: string;
}
