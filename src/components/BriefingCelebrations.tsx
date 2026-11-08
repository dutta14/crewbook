import { Link } from 'react-router-dom';
import type { BriefingCelebration } from '../types/briefing';
import type { TeamMember } from '../types/TeamMember';
import '../styles/todays-one-ones.css';
import { Avatar } from './Avatar';
import { BriefingSection } from './BriefingSection';
import { CakeIcon, StarIcon } from './icons';

interface BriefingCelebrationsProps {
  celebrations: BriefingCelebration[];
  /** Used for avatar images only. */
  members: TeamMember[];
  index?: number;
}

/** Birthdays and work anniversaries inside their reminder lead time. */
export function BriefingCelebrations({ celebrations, members, index }: BriefingCelebrationsProps) {
  return (
    <BriefingSection
      id="celebrations"
      title="Birthdays & Anniversaries"
      count={celebrations.length}
      index={index}
    >
      {celebrations.length === 0 ? (
        <div className="todays-card__empty">
          <p>No birthdays or anniversaries coming up</p>
        </div>
      ) : (
        <ul className="todays-card__list">
          {celebrations.map((celebration) => {
            const Icon = celebration.eventType === 'anniversary' ? StarIcon : CakeIcon;
            return (
              <li
                key={`${celebration.engineerId}:${celebration.eventType}`}
                className="digest-item"
              >
                <Link
                  className="digest-row"
                  to={`/person/${celebration.engineerId}`}
                  aria-label={`${celebration.name}: ${celebration.eventLabel}, ${celebration.timing}`}
                >
                  <span className="digest-row__who">
                    <Avatar
                      name={celebration.name}
                      avatarUrl={
                        members.find((member) => member.id === celebration.engineerId)?.avatarUrl
                      }
                      size="sm"
                      aria-hidden
                    />
                    <span className="digest-row__name">{celebration.name}</span>
                  </span>
                  <span className="digest-row__meta">
                    <span className="briefing-badge">
                      <Icon size={12} />
                      {celebration.eventLabel}
                    </span>
                    <span className="digest-row__last-met">{celebration.timing}</span>
                  </span>
                </Link>
                {celebration.conversationStarter ? (
                  <p className="briefing-starter date-reminder__starter">
                    {celebration.conversationStarter}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </BriefingSection>
  );
}
