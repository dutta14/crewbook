import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createDecision } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { DecisionCard } from './DecisionCard';

const ALEX = '11111111-1111-4111-8111-111111111111';
const NOTE = '99999999-9999-4999-8999-999999999999';

const decision = createDecision({
  engineerId: ALEX,
  title: 'Adopt new CI pipeline',
  context: 'Builds take 40 minutes today.',
  date: '2025-01-15',
  linkedMeetingId: NOTE,
  linkedMeetingDate: '2025-01-15',
});

function LocationProbe() {
  const { pathname, search, state } = useLocation();
  const noteId = (state as { noteId?: string } | null)?.noteId ?? '';
  return <output aria-label="Location">{`${pathname}|${search}|${noteId}`}</output>;
}

const renderCard = (props: Partial<Parameters<typeof DecisionCard>[0]> = {}) =>
  renderWithProviders(
    <>
      <DecisionCard decision={decision} {...props} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </>,
  );

describe('DecisionCard', () => {
  it('renders the title, context, date and the link to the 1:1', () => {
    renderCard();

    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('Decision');
    expect(card).toHaveTextContent('Adopt new CI pipeline');
    expect(card).toHaveTextContent('Builds take 40 minutes today.');
    expect(card.querySelector('time')).toHaveAttribute('datetime', '2025-01-15');
    expect(card.querySelector('time')).toHaveTextContent('Jan 15, 2025');
    expect(screen.getByRole('link', { name: /1:1 notes/ })).toHaveTextContent(
      'From 1:1 on Jan 15, 2025',
    );
  });

  it('leaves the context out of attributes so clipping it never hides text in the DOM', () => {
    const { container } = renderCard();

    expect(container.querySelector('[title]')).toBeNull();
    expect(screen.getByText('Builds take 40 minutes today.')).toHaveClass('decision-card__context');
  });

  it('omits the context paragraph when there is none', () => {
    renderCard({ decision: { ...decision, context: '' } });

    expect(screen.queryByText('Builds take 40 minutes today.')).not.toBeInTheDocument();
  });

  it('links to the profile with the note id in router state, not in the URL', async () => {
    const user = userEvent.setup();
    renderCard();

    const link = screen.getByRole('link', { name: 'View 1:1 notes from January 15, 2025' });
    await user.click(link);

    expect(screen.getByLabelText('Location')).toHaveTextContent(`/person/${ALEX}||${NOTE}`);
  });

  it('is an article labelled with its type and title', () => {
    renderCard();

    expect(screen.getByRole('article', { name: 'Decision: Adopt new CI pipeline' })).toBeVisible();
  });

  it('says the note is unavailable when it no longer exists', () => {
    renderCard({ isMeetingAvailable: false });

    expect(screen.getByText('Meeting note unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /1:1 notes/ })).not.toBeInTheDocument();
  });

  it('says the note is unavailable while the 1:1 has not been saved', () => {
    renderCard({ decision: { ...decision, linkedMeetingId: '', linkedMeetingDate: '' } });

    expect(screen.getByText('Meeting note unavailable')).toBeInTheDocument();
  });

  it('names the person when asked to', () => {
    renderCard({ personName: 'Alex Chen' });

    expect(screen.getByRole('link', { name: 'Alex Chen' })).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderCard({ personName: 'Alex Chen' });

    expect(await axe(container)).toHaveNoViolations();
  });
});
