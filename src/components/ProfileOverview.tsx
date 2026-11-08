import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TeamMember } from '../types/TeamMember';
import { toMailtoHref } from '../utils/email';
import { formatStartDate, toDateAttribute } from '../utils/startDate';
import '../styles/profile.css';
import { StatusBadge, toBadgeStatus } from './StatusBadge';

interface ProfileOverviewProps {
  member: TeamMember;
  manager: TeamMember | null;
}

const NOT_SET = 'Not set';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="profile-field">
      <dt className="profile-field__label">{label}</dt>
      <dd className="profile-field__value">{children}</dd>
    </div>
  );
}

export function ProfileOverview({ member, manager }: ProfileOverviewProps) {
  const startDate = formatStartDate(member.startDate);
  const mailto = member.email ? toMailtoHref(member.email) : null;
  const customFields = Object.entries(member.customFields ?? {});

  return (
    <dl className="profile-fields">
      <Field label="Role">{member.role || NOT_SET}</Field>
      <Field label="Level">{member.level || NOT_SET}</Field>
      <Field label="Status">
        <StatusBadge status={toBadgeStatus(member.status)} />
      </Field>
      <Field label="Start date">
        {startDate ? (
          <time dateTime={toDateAttribute(member.startDate)}>{startDate}</time>
        ) : (
          NOT_SET
        )}
      </Field>
      <Field label="Email">
        {member.email ? (
          mailto ? (
            <a className="profile-link" href={mailto}>
              {member.email}
            </a>
          ) : (
            member.email
          )
        ) : (
          NOT_SET
        )}
      </Field>
      <Field label="Manager">
        {manager ? (
          <Link className="profile-link" to={`/person/${manager.id}`}>
            {manager.name}
          </Link>
        ) : (
          NOT_SET
        )}
      </Field>
      {customFields.map(([key, value]) => (
        <Field key={key} label={key}>
          {value || NOT_SET}
        </Field>
      ))}
    </dl>
  );
}
