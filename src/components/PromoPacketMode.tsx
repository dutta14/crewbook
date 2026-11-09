import { useId, useMemo, useState } from 'react';
import { FEEDBACK_TYPE_LABELS } from '../data/feedbackStore';
import { useToast } from '../hooks/useToast';
import type { TeamMember } from '../types/TeamMember';
import { copyWithAutoClear } from '../utils/clipboard';
import { toIsoDate } from '../utils/scheduleCalculator';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/feedback.css';

const COPY_TOAST_MS = 4000;

interface PromoPacketModeProps {
  members: Pick<TeamMember, 'id' | 'name'>[];
  /** When set the packet is for this person and the person picker is hidden. */
  lockedEngineerId?: string;
  exportPromoPacket: (engineerId: string, range: { start: string; end: string }) => string;
}

/**
 * Builds copy-friendly text of one person's positive feedback for a date range. The type is fixed
 * to positive and shown as such; it is not a choice, so nothing else can end up in a write-up.
 */
export function PromoPacketMode({
  members,
  lockedEngineerId,
  exportPromoPacket,
}: PromoPacketModeProps) {
  const prefix = useId();
  const { showToast } = useToast();
  const [engineerId, setEngineerId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [today] = useState(() => toIsoDate(new Date()));
  const personId = lockedEngineerId ?? engineerId;
  const isReady = personId !== '' && start !== '' && end !== '' && start <= end;

  const packet = useMemo(
    () => (isReady ? exportPromoPacket(personId, { start, end }) : ''),
    [isReady, exportPromoPacket, personId, start, end],
  );

  const handleCopy = async () => {
    try {
      await copyWithAutoClear(packet);
      // Deliberately no excerpt: the toast may be on a shared screen.
      showToast('Copied to clipboard', 'success', COPY_TOAST_MS);
      setAnnouncement('Copied to clipboard');
    } catch {
      showToast('Copy failed. Try again.', 'error');
    }
  };

  return (
    <section className="promo-packet" aria-label="Promo packet mode">
      <div className="promo-packet__controls">
        {lockedEngineerId ? null : (
          <div className="feedback-filters__field">
            <label className="form-label" htmlFor={`${prefix}-person`}>
              Person
            </label>
            <select
              id={`${prefix}-person`}
              className="form-input"
              value={engineerId}
              onChange={(event) => {
                setEngineerId(event.target.value);
                setAnnouncement('');
              }}
            >
              <option value="">Choose a person</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="feedback-filters__field">
          <span className="form-label">Type</span>
          <span className="promo-packet__type">{FEEDBACK_TYPE_LABELS.positive} only</span>
        </div>
        <div className="feedback-filters__field">
          <label className="form-label" htmlFor={`${prefix}-from`}>
            From
          </label>
          <input
            id={`${prefix}-from`}
            type="date"
            className="form-input"
            max={end || today}
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setAnnouncement('');
            }}
          />
        </div>
        <div className="feedback-filters__field">
          <label className="form-label" htmlFor={`${prefix}-to`}>
            To
          </label>
          <input
            id={`${prefix}-to`}
            type="date"
            className="form-input"
            min={start || undefined}
            max={today}
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              setAnnouncement('');
            }}
          />
        </div>
      </div>
      {isReady ? (
        <>
          {/* A scrolling region must be focusable so keyboard users can scroll it. */}
          <pre
            className="promo-packet__output"
            role="region"
            aria-label="Promo packet text"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            {packet}
          </pre>
          <button
            type="button"
            className="btn btn-primary"
            aria-label="Copy promo packet to clipboard"
            onClick={() => void handleCopy()}
          >
            Copy
          </button>
        </>
      ) : (
        <p className="promo-packet__hint">
          Choose {lockedEngineerId ? 'a date range' : 'a person and a date range'} to build the
          packet.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
