import type { AgendaItem } from '../types/agenda';
import { shortenForLabel } from '../utils/agendaFormat';
import { formatNoteDate } from '../utils/noteFormat';
import { CloseIcon } from './icons';

interface AgendaPrepItemProps {
  item: AgendaItem;
  memberName: string;
  onDelete: (id: string) => void;
  onShareChange: (id: string, include: boolean) => void;
}

/** A topic in the prep card, with the manager's controls: choose whether it is shared, or remove it. */
export function AgendaPrepItem({ item, memberName, onDelete, onShareChange }: AgendaPrepItemProps) {
  const isShared = item.includeInShare === true;
  const by = item.addedBy === 'engineer' ? memberName : 'You';
  const label = shortenForLabel(item.text);

  return (
    <li className={`agenda-item${isShared ? '' : ' agenda-item--unshared'}`}>
      <p className="agenda-item__text">{item.text}</p>
      <div className="agenda-item__meta">
        <span className="agenda-item__by" aria-label={`Added by ${by}`}>
          {by}
        </span>
        <time className="agenda-item__time" dateTime={item.createdAt}>
          {formatNoteDate(item.createdAt)}
        </time>
        {isShared ? null : <span className="agenda-item__badge">Not shared</span>}
        <label className="agenda-item__share">
          <input
            type="checkbox"
            checked={isShared}
            aria-label={`Include in share link: ${label}`}
            onChange={(event) => onShareChange(item.id, event.target.checked)}
          />
          <span>Include in share link</span>
        </label>
      </div>
      <button
        type="button"
        className="icon-btn agenda-item__delete"
        aria-label={`Remove agenda item: ${label}`}
        onClick={() => onDelete(item.id)}
      >
        <CloseIcon size={16} />
      </button>
    </li>
  );
}
