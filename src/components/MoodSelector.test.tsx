import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { MoodScore } from '../types/MoodEntry';
import { MoodSelector } from './MoodSelector';

const LABELS = ['Very low energy', 'Low energy', 'Neutral', 'Good energy', 'Great energy'];

function Harness({
  onChange = () => undefined,
  disabled,
}: {
  onChange?: (value: MoodScore | null) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<MoodScore | null>(null);
  return (
    <MoodSelector
      value={value}
      disabled={disabled}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('MoodSelector', () => {
  it('renders five unselected radios in a group named Energy level', () => {
    render(<Harness />);

    expect(screen.getByRole('radiogroup', { name: 'Energy level' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(LABELS);
    radios.forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'));
  });

  it('uses a fieldset with a visually hidden legend', () => {
    const { container } = render(<Harness />);

    const legend = container.querySelector('fieldset > legend');
    expect(legend).toHaveTextContent('Energy level');
    expect(legend).toHaveClass('sr-only');
  });

  it('selects a radio on click and reports its number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(radio('Great energy'));

    expect(radio('Great energy')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Neutral')).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('clears the value when the selected radio is clicked again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(radio('Neutral'));
    await user.click(radio('Neutral'));

    expect(radio('Neutral')).toHaveAttribute('aria-checked', 'false');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('is a single tab stop and arrow keys move focus without selecting', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Harness />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    await user.tab();
    expect(radio('Very low energy')).toHaveFocus();
    expect(radio('Low energy')).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(radio('Neutral')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowUp}{ArrowUp}');
    expect(radio('Great energy')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(radio('Very low energy')).toHaveFocus();
    await user.keyboard('{End}');
    expect(radio('Great energy')).toHaveFocus();
    screen.getAllByRole('radio').forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'));

    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('selects the focused radio with Space or Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.tab();
    await user.keyboard('{ArrowRight}{ }');
    expect(onChange).toHaveBeenLastCalledWith(2);
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('puts the selected radio in the tab order', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(radio('Good energy'));

    expect(radio('Good energy')).toHaveAttribute('tabindex', '0');
    expect(radio('Very low energy')).toHaveAttribute('tabindex', '-1');
  });

  it('shows the prompt and a privacy indicator readable by screen readers', () => {
    render(<Harness />);

    expect(screen.getByText('How did they seem?')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeVisible();
  });

  it('renders nothing when mood tracking is disabled', () => {
    const { container } = render(<Harness disabled />);

    expect(container).toBeEmptyDOMElement();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
