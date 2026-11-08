import type { PrivateNote } from '../types/flightRisk';
import '../styles/flight-risk.css';

interface PrivateNoteItemProps {
  note: PrivateNote;
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Read-only on purpose: private notes are an append-only record, with no edit or delete. */
export function PrivateNoteItem({ note }: PrivateNoteItemProps) {
  return (
    <li className="private-note">
      <time className="private-note__time" dateTime={note.createdAt}>
        {formatStamp(note.createdAt)}
      </time>
      <p className="private-note__text">{note.text}</p>
    </li>
  );
}
