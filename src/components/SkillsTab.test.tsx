import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createSkill } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { Skill } from '../types/skill';
import { SkillsTab } from './SkillsTab';

const seeded = (): Skill[] => [
  createSkill({
    name: 'TypeScript',
    level: 'expert',
    category: 'strength',
    notes: 'Owns the type system',
  }),
  createSkill({ name: 'System design', level: 'competent', category: 'strength' }),
  createSkill({ name: 'Rust', level: 'learning', category: 'growth' }),
];

function renderTab(skills: Skill[] = seeded()) {
  const onAddSkill = vi.fn().mockResolvedValue(undefined);
  const onEditSkill = vi.fn().mockResolvedValue(undefined);
  const onRemoveSkill = vi.fn().mockResolvedValue(undefined);
  const view = renderWithProviders(
    <SkillsTab
      skills={skills}
      onAddSkill={onAddSkill}
      onEditSkill={onEditSkill}
      onRemoveSkill={onRemoveSkill}
    />,
  );
  return { ...view, onAddSkill, onEditSkill, onRemoveSkill };
}

const strengths = () => screen.getByRole('region', { name: 'Strengths' });
const growth = () => screen.getByRole('region', { name: 'Growth Areas' });

describe('SkillsTab', () => {
  it('splits skills into Strengths and Growth Areas sections', () => {
    renderTab();

    expect(within(strengths()).getByText('TypeScript')).toBeInTheDocument();
    expect(within(strengths()).getByText('System design')).toBeInTheDocument();
    expect(within(strengths()).queryByText('Rust')).not.toBeInTheDocument();
    expect(within(growth()).getByText('Rust')).toBeInTheDocument();
  });

  it('shows each skill’s proficiency as text and its notes', () => {
    renderTab();

    expect(within(strengths()).getByText('Expert')).toBeInTheDocument();
    expect(within(strengths()).getByText('Competent')).toBeInTheDocument();
    expect(within(growth()).getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Owns the type system')).toBeInTheDocument();
  });

  it('shows an empty state in each empty section', () => {
    renderTab([]);

    expect(
      within(strengths()).getByRole('heading', { name: 'No strengths documented yet' }),
    ).toBeInTheDocument();
    expect(
      within(growth()).getByRole('heading', { name: 'No growth areas documented yet' }),
    ).toBeInTheDocument();
  });

  it('adds a skill to the strengths section with the chosen level and notes', async () => {
    const user = userEvent.setup();
    const { onAddSkill } = renderTab();

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), '  React ');
    await user.selectOptions(screen.getByLabelText('Proficiency level'), 'proficient');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Hooks all day');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddSkill).toHaveBeenCalledWith({
      name: '  React ',
      level: 'proficient',
      notes: 'Hooks all day',
      category: 'strength',
    });
  });

  it('adds a skill to the growth section as a growth area', async () => {
    const user = userEvent.setup();
    const { onAddSkill } = renderTab();

    await user.click(screen.getByRole('button', { name: 'Add skill to Growth Areas' }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'Go');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddSkill).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Go', category: 'growth' }),
    );
  });

  it('focuses the name field when the form opens and returns focus to the add button after saving', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'React');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add skill to Strengths' })).toHaveFocus(),
    );
  });

  it('asks for a skill name and saves nothing when it is empty', async () => {
    const user = userEvent.setup();
    const { onAddSkill } = renderTab();

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter a skill name')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toBeInvalid();
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toHaveFocus();
    expect(onAddSkill).not.toHaveBeenCalled();
  });

  it('shows the data layer’s validation message next to the field and keeps the form open', async () => {
    const user = userEvent.setup();
    const { onAddSkill } = renderTab();
    onAddSkill.mockRejectedValueOnce(
      new ValidationError('Strengths already has a skill with that name'),
    );

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'TypeScript');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Strengths already has a skill with that name')).toBeVisible();
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toHaveValue('TypeScript');
  });

  it('keeps the form open and enabled after a save that failed for another reason', async () => {
    const user = userEvent.setup();
    const { onAddSkill } = renderTab();
    onAddSkill.mockRejectedValueOnce(new Error('disk full'));

    await user.click(screen.getByRole('button', { name: 'Add skill to Strengths' }));
    await user.type(screen.getByRole('textbox', { name: /Skill name/ }), 'React');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toHaveValue('React');
  });

  it('closes the add form on Escape and returns focus to the add button', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Add skill to Growth Areas' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox', { name: /Skill name/ })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add skill to Growth Areas' })).toHaveFocus(),
    );
  });

  it('edits a skill in place with its current values filled in', async () => {
    const user = userEvent.setup();
    const { onEditSkill } = renderTab();
    const typescript = screen.getByText('TypeScript').closest('li') as HTMLElement;

    await user.click(within(typescript).getByRole('button', { name: 'Edit TypeScript' }));
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toHaveValue('TypeScript');
    expect(screen.getByLabelText('Proficiency level')).toHaveValue('expert');
    await user.selectOptions(screen.getByLabelText('Proficiency level'), 'proficient');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEditSkill).toHaveBeenCalledWith(expect.any(String), {
      name: 'TypeScript',
      level: 'proficient',
      notes: 'Owns the type system',
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit TypeScript' })).toHaveFocus(),
    );
  });

  it('cancels an edit without saving and with Escape', async () => {
    const user = userEvent.setup();
    const { onEditSkill } = renderTab();

    await user.click(screen.getByRole('button', { name: 'Edit Rust' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox', { name: /Skill name/ })).not.toBeInTheDocument();
    expect(onEditSkill).not.toHaveBeenCalled();
  });

  it('keeps only one form open at a time', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Edit Rust' }));
    await user.click(screen.getByRole('button', { name: 'Add skill to Growth Areas' }));

    expect(screen.getAllByRole('textbox', { name: /Skill name/ })).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: /Skill name/ })).toHaveValue('');
  });

  it('asks before removing, moves focus to No and removes only after Yes', async () => {
    const user = userEvent.setup();
    const { onRemoveSkill } = renderTab();

    await user.click(screen.getByRole('button', { name: 'Remove Rust' }));
    const prompt = screen.getByRole('group', { name: 'Remove Rust?' });
    expect(within(prompt).getByRole('button', { name: 'No' })).toHaveFocus();
    expect(onRemoveSkill).not.toHaveBeenCalled();
    await user.click(within(prompt).getByRole('button', { name: 'Yes' }));

    expect(onRemoveSkill).toHaveBeenCalledWith(expect.any(String));
  });

  it('keeps the skill when the removal is declined or dismissed with Escape', async () => {
    const user = userEvent.setup();
    const { onRemoveSkill } = renderTab();

    await user.click(screen.getByRole('button', { name: 'Remove Rust' }));
    await user.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.getByRole('button', { name: 'Remove Rust' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove Rust' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('group', { name: 'Remove Rust?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Rust' })).toHaveFocus();
    expect(onRemoveSkill).not.toHaveBeenCalled();
  });

  it('puts the prompt away when the removal could not be saved', async () => {
    const user = userEvent.setup();
    const { onRemoveSkill } = renderTab();
    onRemoveSkill.mockRejectedValueOnce(new Error('disk full'));

    await user.click(screen.getByRole('button', { name: 'Remove Rust' }));
    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(await screen.findByRole('button', { name: 'Remove Rust' })).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
  });

  it('has no accessibility violations with skills, a form and an empty section', async () => {
    const user = userEvent.setup();
    const { container } = renderTab(seeded().slice(0, 1));

    await user.click(screen.getByRole('button', { name: 'Add skill to Growth Areas' }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
