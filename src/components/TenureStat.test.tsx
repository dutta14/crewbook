import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { TenureStat } from './TenureStat';

describe('TenureStat', () => {
  it('shows the average tenure as years and months', () => {
    render(<TenureStat months={28} label="2y 4m" />);

    expect(screen.getByText('Average Tenure')).toBeInTheDocument();
    expect(screen.getByText('2y 4m')).toBeInTheDocument();
  });

  it('is a status region described in words', () => {
    render(<TenureStat months={28} label="2y 4m" />);

    expect(
      screen.getByRole('status', { name: 'Average team tenure: 2 years 4 months' }),
    ).toBeInTheDocument();
  });

  it('uses singular units', () => {
    render(<TenureStat months={13} label="1y 1m" />);

    expect(
      screen.getByRole('status', { name: 'Average team tenure: 1 year 1 month' }),
    ).toBeInTheDocument();
  });

  it('describes whole years and sub-year tenures without empty parts', () => {
    const { rerender } = render(<TenureStat months={24} label="2y 0m" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Average team tenure: 2 years');

    rerender(<TenureStat months={5} label="5m" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Average team tenure: 5 months');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<TenureStat months={28} label="2y 4m" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
