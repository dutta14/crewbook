import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AddMemberModal } from '../components/AddMemberModal';
import { CsvImportModal } from '../components/CsvImportModal';
import { CustomFieldFilters } from '../components/CustomFieldFilters';
import { EmptyState } from '../components/EmptyState';
import { FilterChips } from '../components/FilterChips';
import { SearchIcon, TeamIcon } from '../components/icons';
import { RosterCards } from '../components/RosterCards';
import { RosterTable } from '../components/RosterTable';
import { isTeamMemberStatus, listMembers } from '../data/members';
import { useCustomFields } from '../hooks/useCustomFields';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { useFeedbackQuickAdd } from '../hooks/useFeedbackQuickAdd';
import { useGapAlerts } from '../hooks/useMeetingStats';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../hooks/useToast';
import type { TeamMember, TeamMemberStatus } from '../types/TeamMember';
import { matchesCustomFieldFilters } from '../utils/customFieldFilter';
import { startOfStartDay } from '../utils/startDate';
import '../styles/button.css';
import '../styles/form.css';
import '../styles/table.css';

type SortField = 'name' | 'startDate' | 'level';
type StatusFilter = TeamMemberStatus | 'all';

const MOBILE_QUERY = '(max-width: 767.98px)';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'departing', label: 'Departing' },
  { value: 'new_hire', label: 'New Hire' },
];

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'startDate', label: 'Start date' },
  { value: 'level', label: 'Level' },
];

const byName = (a: TeamMember, b: TeamMember) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

const COMPARATORS: Record<SortField, (a: TeamMember, b: TeamMember) => number> = {
  name: byName,
  startDate: (a, b) =>
    startOfStartDay(a.startDate).getTime() - startOfStartDay(b.startDate).getTime() || byName(a, b),
  // Numeric collation puts L2 before L10.
  level: (a, b) =>
    a.level.localeCompare(b.level, undefined, { numeric: true, sensitivity: 'base' }) ||
    byName(a, b),
};

const isSortField = (value: string): value is SortField =>
  SORT_OPTIONS.some((option) => option.value === value);

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'} found`;
}

export function Roster() {
  const storage = useEncryptedStorage();
  const { showToast } = useToast();
  const { openQuickAdd, quickAddModal } = useFeedbackQuickAdd();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Search, filter and sort live in React state only, never in the URL or storage.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const members = useMemo(() => listMembers(storage), [storage]);
  const { definitions } = useCustomFields();
  const [customFilters, setCustomFilters] = useState<Record<string, string>>({});
  const gapAlerts = useGapAlerts();
  const gapAlertsById = useMemo(
    () => new Map(gapAlerts.map((alert) => [alert.engineerId, alert])),
    [gapAlerts],
  );
  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members
      .filter((member) => statusFilter === 'all' || member.status === statusFilter)
      .filter(
        (member) =>
          query === '' ||
          member.name.toLowerCase().includes(query) ||
          member.role.toLowerCase().includes(query),
      )
      .filter((member) => matchesCustomFieldFilters(member, definitions, customFilters))
      .sort(COMPARATORS[sortBy]);
  }, [members, search, statusFilter, sortBy, definitions, customFilters]);

  const handleAddMember = () => setIsAddOpen(true);
  const handleImportCsv = () => setIsImportOpen(true);
  // The modals are always the second child of the same fragment, so they stay mounted when the
  // first member arrives (for example from an import) and the empty state gives way to the list.
  const modals = (
    <>
      <AddMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={(member) => showToast(`${member.name} added to your team`, 'success')}
        members={members}
      />
      <CsvImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
      {quickAddModal}
    </>
  );

  const content =
    members.length === 0 ? (
      <>
        <h1>Team</h1>
        <EmptyState
          icon={<TeamIcon size={48} />}
          title="No team members yet"
          action={{ label: 'Add your first team member', onClick: handleAddMember }}
          secondaryAction={{ label: 'Import CSV', onClick: handleImportCsv }}
        />
      </>
    ) : (
      <>
        <div className="roster-header">
          <h1>Team</h1>
          <div className="roster-header__actions">
            <Link to="/team/tenure" className="btn btn-secondary">
              Tenure timeline
            </Link>
            <button type="button" className="btn btn-secondary" onClick={handleImportCsv}>
              Import CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAddMember}>
              Add member
            </button>
          </div>
        </div>
        <div className="roster-search" role="search">
          <label className="sr-only" htmlFor="roster-search">
            Search team members by name or role
          </label>
          <div className="search-field">
            <SearchIcon size={16} />
            <input
              id="roster-search"
              type="search"
              className="form-input search-field__input"
              placeholder="Search by name or role..."
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="roster-controls">
          <FilterChips
            ariaLabel="Filter by status"
            options={FILTER_OPTIONS}
            value={statusFilter}
            onChange={(value) => setStatusFilter(isTeamMemberStatus(value) ? value : 'all')}
          />
          <div className="roster-sort">
            <label htmlFor="roster-sort">Sort by</label>
            <select
              id="roster-sort"
              className="form-input"
              value={sortBy}
              onChange={(event) => {
                if (isSortField(event.target.value)) setSortBy(event.target.value);
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <CustomFieldFilters
          definitions={definitions}
          filters={customFilters}
          onChange={(key, value) => setCustomFilters((current) => ({ ...current, [key]: value }))}
          onClear={() => setCustomFilters({})}
        />
        <div className="sr-only" role="status" aria-live="polite">
          {countLabel(visibleMembers.length)}
        </div>
        {visibleMembers.length === 0 ? (
          <p className="roster-empty">No members found</p>
        ) : isMobile ? (
          <RosterCards
            members={visibleMembers}
            gapAlerts={gapAlertsById}
            onLogFeedback={(memberId) => void openQuickAdd(memberId)}
          />
        ) : (
          <RosterTable
            members={visibleMembers}
            gapAlerts={gapAlertsById}
            onLogFeedback={(memberId) => void openQuickAdd(memberId)}
          />
        )}
      </>
    );

  return (
    <>
      {content}
      {modals}
    </>
  );
}
