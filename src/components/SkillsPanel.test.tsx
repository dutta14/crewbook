import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMember, createSkill } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { SkillsPanel } from './SkillsPanel';

const envelope = vi.hoisted(() => ({ state: { isReady: true, loadFailed: false } }));

vi.mock('../hooks/usePrivateEnvelope', () => ({
  usePrivateEnvelope: () => envelope.state,
}));

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

const renderPanel = (skills: unknown[] = []) =>
  renderWithProviders(<SkillsPanel memberId={ALEX.id} />, {
    initialData: { members: [ALEX, PRIYA] },
    initialPrivateData: { skills },
  });

beforeEach(() => {
  envelope.state = { isReady: true, loadFailed: false };
});

describe('SkillsPanel', () => {
  it('shows only the member’s own skills', () => {
    renderPanel([
      createSkill({ memberId: ALEX.id, name: 'Kotlin' }),
      createSkill({ memberId: PRIYA.id, name: 'Haskell' }),
    ]);

    expect(screen.getByText('Kotlin')).toBeInTheDocument();
    expect(screen.queryByText('Haskell')).not.toBeInTheDocument();
  });

  it('waits for the private envelope before showing any skill', () => {
    envelope.state = { isReady: false, loadFailed: false };

    renderPanel([createSkill({ memberId: ALEX.id, name: 'Kotlin' })]);

    expect(screen.getByText('Opening skills…')).toBeInTheDocument();
    expect(screen.queryByText('Kotlin')).not.toBeInTheDocument();
  });

  it('tells the manager when the private envelope could not be opened', () => {
    envelope.state = { isReady: false, loadFailed: true };

    renderPanel();

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open skills");
  });

  it('adds, edits and removes a skill through the store', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'Kotlin');
    await user.selectOptions(screen.getByLabelText('Proficiency level'), 'expert');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const strengths = screen.getByRole('region', { name: 'Strengths' });
    expect(await within(strengths).findByText('Expert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit Kotlin' }));
    await user.clear(screen.getByRole('textbox', { name: /Skill name/ }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'Swift');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(strengths).findByText('Swift')).toBeInTheDocument();
    expect(within(strengths).queryByText('Kotlin')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Swift' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(within(strengths).queryByText('Swift')).not.toBeInTheDocument());
  });

  it('shows the duplicate message when the same strength is added twice', async () => {
    const user = userEvent.setup();
    renderPanel([createSkill({ memberId: ALEX.id, name: 'Kotlin' })]);

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'kotlin');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/already has a skill with that name/)).toBeVisible();
  });
});
