import type { Ref } from 'react';
import type { TeamMember } from '../types/TeamMember';
import { toMailtoHref } from '../utils/email';
import { formatStartDate, toDateAttribute } from '../utils/startDate';
import '../styles/button.css';
import '../styles/profile.css';
import { Avatar } from './Avatar';
import { StatusBadge, toBadgeStatus } from './StatusBadge';

interface ProfileHeaderProps {
  member: TeamMember;
  onEdit: () => void;
  /** The Start 1:1 button is only shown when a handler is provided. */
  onStartOneOnOne?: () => void;
  /** The delete button is only shown when a handler is provided. */
  onDelete?: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

export function ProfileHeader({
  member,
  onEdit,
  onStartOneOnOne,
  onDelete,
  headingRef,
}: ProfileHeaderProps) {
  const roleAndLevel = [member.role, member.level].filter(Boolean).join(' · ');
  const startDate = formatStartDate(member.startDate);
  const mailto = member.email ? toMailtoHref(member.email) : null;

  return (
    <header className="profile-header">
      <Avatar name={member.name} size="lg" avatarUrl={member.avatarUrl} aria-hidden />
      <div className="profile-header__body">
        <h1 ref={headingRef} className="profile-header__name" tabIndex={-1}>
          {member.name}
        </h1>
        {roleAndLevel ? <p className="profile-header__role">{roleAndLevel}</p> : null}
        <StatusBadge status={toBadgeStatus(member.status)} />
        {startDate || member.email ? (
          <p className="profile-header__meta">
            {startDate ? (
              <span>
                Started <time dateTime={toDateAttribute(member.startDate)}>{startDate}</time>
              </span>
            ) : null}
            {member.email ? (
              mailto ? (
                <a className="profile-link" href={mailto}>
                  {member.email}
                </a>
              ) : (
                <span>{member.email}</span>
              )
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="profile-header__actions">
        {onStartOneOnOne ? (
          <button type="button" className="btn btn-primary" onClick={onStartOneOnOne}>
            Start 1:1
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          aria-label={`Edit ${member.name}'s profile`}
          onClick={onEdit}
        >
          Edit
        </button>
        {onDelete ? (
          <button
            type="button"
            className="btn btn-secondary profile-header__delete"
            aria-label={`Delete ${member.name}`}
            onClick={onDelete}
          >
            Delete
          </button>
        ) : null}
      </div>
    </header>
  );
}
