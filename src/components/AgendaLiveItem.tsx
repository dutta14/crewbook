import type { AgendaItem } from '../types/agenda';
import { shortenForLabel } from '../utils/agendaFormat';

interface AgendaLiveItemProps {
  item: AgendaItem;
  onToggle: (id: string) => void;
}

/** A topic in live mode: a checkbox the manager ticks once it has been talked through. */
export function AgendaLiveItem({ item, onToggle }: AgendaLiveItemProps) {
  const isDiscussed = item.discussed === true;
  return (
    <li className={`agenda-live${isDiscussed ? ' agenda-live--discussed' : ''}`}>
      <label className="agenda-live__label">
        <input
          type="checkbox"
          checked={isDiscussed}
          aria-label={`Mark ${shortenForLabel(item.text)} as discussed`}
          onChange={() => onToggle(item.id)}
        />
        <span className="agenda-live__text">{item.text}</span>
      </label>
    </li>
  );
}
