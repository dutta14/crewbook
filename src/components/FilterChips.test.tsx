import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { FilterChips } from './FilterChips';

const OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'done', label: 'Done' },
];

function Controlled({ initial = 'all' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <FilterChips options={OPTIONS} value={value} onChange={setValue} ariaLabel="Status" />;
}

describe('FilterChips', () => {
  it('renders a labelled radiogroup with one radio per option', () => {
    render(<Controlled />);

    expect(screen.getByRole('radiogroup', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual([
      'All',
      'Open',
      'Done',
    ]);
  });

  it('marks only the selected chip as checked', () => {
    render(<Controlled initial="open" />);

    expect(screen.getByRole('radio', { name: 'Open' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Done' })).not.toBeChecked();
  });

  it('makes only the selected chip a tab stop', () => {
    render(<Controlled initial="open" />);

    expect(screen.getByRole('radio', { name: 'Open' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('tabindex', '-1');
  });

  it('falls back to the first chip as the tab stop when the value matches no option', () => {
    render(<Controlled initial="missing" />);

    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('tabindex', '0');
    screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());
  });

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips options={OPTIONS} value="all" onChange={onChange} ariaLabel="Status" />);

    await user.click(screen.getByRole('radio', { name: 'Done' }));

    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('moves selection and focus right with ArrowRight', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    screen.getByRole('radio', { name: 'All' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'Open' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Open' })).toHaveFocus();
  });

  it('wraps from the last chip to the first with ArrowRight', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="done" />);
    screen.getByRole('radio', { name: 'Done' }).focus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('moves selection left with ArrowLeft and wraps from the first chip to the last', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    screen.getByRole('radio', { name: 'All' }).focus();

    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('radio', { name: 'Done' })).toBeChecked();
  });

  it('moves selection with the vertical arrow keys too', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="open" />);
    screen.getByRole('radio', { name: 'Open' }).focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Done' })).toBeChecked();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: 'Open' })).toBeChecked();
  });

  it('jumps to the last chip with End and the first chip with Home', async () => {
    const user = userEvent.setup();
    render(<Controlled initial="open" />);
    screen.getByRole('radio', { name: 'Open' }).focus();

    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Done' })).toBeChecked();

    await user.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
  });

  it('ignores unrelated keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips options={OPTIONS} value="all" onChange={onChange} ariaLabel="Status" />);
    screen.getByRole('radio', { name: 'All' }).focus();

    await user.keyboard('a');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders an empty group without errors', async () => {
    const user = userEvent.setup();
    render(<FilterChips options={[]} value="" onChange={vi.fn()} ariaLabel="Empty" />);

    expect(screen.getByRole('radiogroup', { name: 'Empty' })).toBeInTheDocument();
    await user.tab();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Controlled />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
