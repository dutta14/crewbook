import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMember, createSkill } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { SkillsMatrix } from './SkillsMatrix';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });
const MEMBERS = [ALEX, PRIYA];

const SKILLS = [
  createSkill({ memberId: ALEX.id, name: 'TypeScript', level: 'expert' }),
  createSkill({ memberId: ALEX.id, name: 'React', level: 'proficient' }),
  createSkill({ memberId: PRIYA.id, name: 'React', level: 'learning' }),
  createSkill({ memberId: PRIYA.id, name: 'Go', level: 'competent' }),
];

function setViewport(isNarrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: isNarrow,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

const renderMatrix = (skills = SKILLS) =>
  renderWithProviders(<SkillsMatrix members={MEMBERS} skills={skills} />);

afterEach(() => vi.unstubAllGlobals());

describe('SkillsMatrix', () => {
  it('shows a table with people as rows and skills as alphabetical columns', () => {
    renderMatrix();

    const table = screen.getByRole('table', { name: 'Skills documented for each team member' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Team member',
      'Go',
      'React',
      'TypeScript',
    ]);
    expect(within(table).getByRole('rowheader', { name: 'Alex Chen' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Priya Nair' })).toBeInTheDocument();
  });

  it('shows each documented level as a text badge in the right cell', () => {
    renderMatrix();

    const alex = screen.getByRole('row', { name: /Alex Chen/ });
    const cells = within(alex).getAllByRole('cell');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '—Not documented',
      'Proficient',
      'Expert',
    ]);
  });

  it('marks a skill nobody documented for a person as not documented for screen readers', () => {
    renderMatrix();

    const priya = screen.getByRole('row', { name: /Priya Nair/ });
    expect(within(priya).getByText('Not documented')).toBeInTheDocument();
  });

  it('merges skills that differ only in letter case into one column', () => {
    renderMatrix([
      createSkill({ memberId: ALEX.id, name: 'react', level: 'expert' }),
      createSkill({ memberId: PRIYA.id, name: 'React', level: 'learning' }),
    ]);

    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('filters columns and people by skill name, ignoring case, and announces the count', async () => {
    const user = userEvent.setup();
    renderMatrix();

    await user.type(screen.getByRole('searchbox', { name: 'Filter skills' }), 'REACT');

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual(['Team member', 'React']);
    expect(await screen.findByText('1 matching skill')).toHaveAttribute('role', 'status');
  });

  it('drops people who have none of the matching skills', async () => {
    const user = userEvent.setup();
    renderMatrix();

    await user.type(screen.getByRole('searchbox', { name: 'Filter skills' }), 'Go');

    expect(await screen.findByRole('rowheader', { name: 'Priya Nair' })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Alex Chen' })).not.toBeInTheDocument();
  });

  it('says so when the filter matches no skill and restores the table once cleared', async () => {
    const user = userEvent.setup();
    renderMatrix();
    const filter = screen.getByRole('searchbox', { name: 'Filter skills' });

    await user.type(filter, 'zzz');
    const count = await screen.findByText('No matching skills');
    expect(count).toHaveAttribute('role', 'status');
    expect(screen.getByText('No skill matches that filter.')).toBeInTheDocument();
    await user.clear(filter);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(count).toBeEmptyDOMElement();
  });

  it('shows an empty state instead of an empty table when no skills are documented', () => {
    renderMatrix([]);

    expect(screen.getByRole('heading', { name: 'No skills documented yet' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('ignores skills of people who are no longer on the team', () => {
    renderMatrix([createSkill({ memberId: 'gone', name: 'COBOL' })]);

    expect(screen.getByRole('heading', { name: 'No skills documented yet' })).toBeInTheDocument();
  });

  it('warns that the data is sensitive', () => {
    renderMatrix();

    expect(screen.getByText('Sensitive data: avoid screen sharing.')).toBeInTheDocument();
  });

  it('shows one card per person with only their skills on a narrow screen', () => {
    setViewport(true);
    renderMatrix();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Skills by team member' });
    const cards = within(list).getAllByRole('heading', { level: 2 });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Alex Chen');
    expect(cards[1]).toHaveTextContent('Priya Nair');
    const alex = cards[0].closest('li') as HTMLElement;
    expect(within(alex).getByText('TypeScript')).toBeInTheDocument();
    expect(within(alex).queryByText('Go')).not.toBeInTheDocument();
  });

  it('says a person has no skills documented in the card layout', () => {
    setViewport(true);
    renderMatrix([createSkill({ memberId: ALEX.id, name: 'Go', level: 'expert' })]);

    const priya = screen.getByRole('heading', { name: 'Priya Nair' }).closest('li') as HTMLElement;
    expect(within(priya).getByText('No skills documented')).toBeInTheDocument();
  });

  it('has no accessibility violations as a table or as cards', async () => {
    const table = renderMatrix();
    expect(await axe(table.container)).toHaveNoViolations();
    table.unmount();

    setViewport(true);
    const cards = renderMatrix();
    expect(await axe(cards.container)).toHaveNoViolations();
  });
});
