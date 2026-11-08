import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Avatar, getAvatarColor, getInitials } from './Avatar';

describe('getInitials', () => {
  it.each([
    ['Alex Chen', 'AC'],
    ['alex  chen', 'AC'],
    ['Mary Jane Watson', 'MW'],
    ['Cher', 'C'],
    ['   ', '?'],
  ])('turns "%s" into "%s"', (name, initials) => {
    expect(getInitials(name)).toBe(initials);
  });
});

describe('getAvatarColor', () => {
  it('returns the same colour for the same name', () => {
    expect(getAvatarColor('Alex Chen')).toBe(getAvatarColor('Alex Chen'));
  });

  it('picks from the design-system palette', () => {
    expect(getAvatarColor('Alex Chen')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('Avatar', () => {
  it('exposes the full name as the accessible name', () => {
    render(<Avatar name="Alex Chen" />);

    expect(screen.getByRole('img', { name: 'Alex Chen' })).toHaveTextContent('AC');
  });

  it('hides itself from assistive technology when decorative', () => {
    render(<Avatar name="Alex Chen" decorative />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('AC').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the requested size', () => {
    render(<Avatar name="Alex Chen" size="lg" />);

    expect(screen.getByRole('img')).toHaveClass('avatar--lg');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Avatar name="Alex Chen" />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
