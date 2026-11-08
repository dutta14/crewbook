import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMoodEntry } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { MoodTrendSection } from './MoodTrendSection';

const ALEX = '11111111-1111-4111-8111-111111111111';
const PRIYA = '22222222-2222-4222-8222-222222222222';

const renderSection = (enabled = true) =>
  renderWithProviders(<MoodTrendSection memberId={ALEX} />, {
    initialData: { settings: { moodTrackingEnabled: String(enabled) } },
    initialPrivateData: {
      moods: [
        createMoodEntry({ memberId: ALEX, score: 5, recordedAt: '2025-01-01T12:00:00.000Z' }),
        createMoodEntry({ memberId: ALEX, score: 2, recordedAt: '2025-01-08T12:00:00.000Z' }),
        createMoodEntry({ memberId: PRIYA, score: 1, recordedAt: '2025-01-09T12:00:00.000Z' }),
      ],
    },
  });

describe('MoodTrendSection', () => {
  it('renders nothing when mood tracking is off', () => {
    const { container } = renderSection(false);

    expect(container).toBeEmptyDOMElement();
  });

  it('starts collapsed so no ratings are in the page', () => {
    const { container } = renderSection();

    const toggle = screen.getByRole('button', { name: 'Show' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: 'Energy trend (private)' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
  });

  it('shows only this member’s ratings once expanded, and hides them again', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByRole('img', { name: 'Energy trend over last 2 sessions' })).toBeVisible();
    expect(screen.getAllByTestId('mood-dot')).toHaveLength(2);
    const toggle = screen.getByRole('button', { name: 'Hide' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the empty state for a member with no ratings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MoodTrendSection memberId={ALEX} />, {
      initialData: { settings: { moodTrackingEnabled: 'true' } },
    });

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('No mood data recorded yet')).toBeInTheDocument();
  });

  it('has no accessibility violations when expanded', async () => {
    const user = userEvent.setup();
    const { container } = renderSection();
    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
