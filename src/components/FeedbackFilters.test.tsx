import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import {
  EMPTY_FILTER_VALUES,
  FeedbackFilters,
  countActiveFilters,
  type FeedbackFilterValues,
} from './FeedbackFilters';

const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
const PRIYA = createMember({ id: 'priya', name: 'Priya Nair' });

function Harness({ showPerson = true, initial = EMPTY_FILTER_VALUES }) {
  const [values, setValues] = useState<FeedbackFilterValues>(initial);
  return (
    <FeedbackFilters
      values={values}
      onChange={setValues}
      members={[ALEX, PRIYA]}
      tags={['demo', 'leadership']}
      showPerson={showPerson}
    />
  );
}

describe('FeedbackFilters', () => {
  it('offers person, type, tag, a date range and search', () => {
    render(<Harness />);

    expect(screen.getByRole('searchbox', { name: 'Search feedback' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Person' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tag' })).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('To')).toHaveAttribute('type', 'date');
  });

  it('hides the person filter when the log is about one person', () => {
    render(<Harness showPerson={false} />);

    expect(screen.queryByRole('combobox', { name: 'Person' })).toBeNull();
  });

  it('shows no count until a filter is set, then counts them', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('img', { name: /active filters/ })).toBeNull();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'positive');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tag' }), 'demo');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-01-01' } });

    expect(screen.getByRole('img', { name: '3 active filters' })).toBeInTheDocument();
  });

  it('clears every filter at once', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('searchbox', { name: 'Search feedback' }), 'demo');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Person' }), ALEX.id);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('searchbox', { name: 'Search feedback' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Person' })).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  });

  it('keeps the date range ordered', () => {
    render(
      <Harness initial={{ ...EMPTY_FILTER_VALUES, start: '2025-02-01', end: '2025-03-01' }} />,
    );

    expect(screen.getByLabelText('From')).toHaveAttribute('max', '2025-03-01');
    expect(screen.getByLabelText('To')).toHaveAttribute('min', '2025-02-01');
  });

  it('counts a person filter only when it can be changed', () => {
    const values = { ...EMPTY_FILTER_VALUES, engineerId: 'alex', search: ' ' };

    expect(countActiveFilters(values, true)).toBe(1);
    expect(countActiveFilters(values, false)).toBe(0);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
