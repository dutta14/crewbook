import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';
import { AVATAR_PALETTE } from '../utils/avatarColor';

const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

describe('Avatar initials', () => {
  it('renders two initials for "Anindya Dutta" as "AD"', () => {
    render(<Avatar name="Anindya Dutta" />);

    expect(screen.getByRole('img', { name: 'Anindya Dutta' })).toHaveTextContent('AD');
  });

  it('renders one initial for single name "Priya" as "P"', () => {
    render(<Avatar name="Priya" />);

    expect(screen.getByRole('img', { name: 'Priya' })).toHaveTextContent(/^P$/);
  });

  it('renders first and last initials for three-word name "John Michael Doe" as "JD"', () => {
    render(<Avatar name="John Michael Doe" />);

    expect(screen.getByRole('img')).toHaveTextContent('JD');
  });

  it('handles empty string name gracefully', () => {
    render(<Avatar name="" />);

    const avatar = screen.getByRole('img', { name: 'Unknown' });
    expect(avatar).toHaveTextContent('');
    expect(avatar.querySelector('img')).toBeNull();
  });

  it('trims whitespace from name before generating initials', () => {
    render(<Avatar name="   Anindya Dutta  " />);

    expect(screen.getByRole('img', { name: 'Anindya Dutta' })).toHaveTextContent('AD');
  });

  it('renders markup in a name as plain text', () => {
    render(<Avatar name="<b>Eve</b>" />);

    expect(screen.getByRole('img').querySelector('b')).toBeNull();
  });
});

describe('Avatar colour', () => {
  it('background color is deterministic for same name', () => {
    const { unmount } = render(<Avatar name="Anindya Dutta" />);
    const first = screen.getByRole('img').style.backgroundColor;
    unmount();
    render(<Avatar name="Anindya Dutta" />);

    expect(screen.getByRole('img').style.backgroundColor).toBe(first);
  });

  it('different names produce different colors', () => {
    const colors = ['AB', 'AC'].map((name) => {
      const { unmount } = render(<Avatar name={name} />);
      const color = screen.getByRole('img').style.backgroundColor;
      unmount();
      return color;
    });

    expect(colors[0]).not.toBe(colors[1]);
  });

  it('uses a palette colour', () => {
    render(<Avatar name="AB" />);

    const hex = AVATAR_PALETTE[1];
    const expected = `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
    expect(screen.getByRole('img').style.backgroundColor).toBe(expected);
  });
});

describe('Avatar size', () => {
  it('renders sm size at 32px', () => {
    render(<Avatar name="Alex Chen" size="sm" />);

    expect(screen.getByRole('img')).toHaveStyle({
      width: '32px',
      height: '32px',
      fontSize: '12px',
    });
  });

  it('renders md size at 40px', () => {
    render(<Avatar name="Alex Chen" size="md" />);

    expect(screen.getByRole('img')).toHaveStyle({
      width: '40px',
      height: '40px',
      fontSize: '14px',
    });
  });

  it('renders lg size at 64px', () => {
    render(<Avatar name="Alex Chen" size="lg" />);

    expect(screen.getByRole('img')).toHaveStyle({
      width: '64px',
      height: '64px',
      fontSize: '22px',
    });
  });

  it('defaults to md', () => {
    render(<Avatar name="Alex Chen" />);

    expect(screen.getByRole('img')).toHaveStyle({ width: '40px' });
  });
});

describe('Avatar photo', () => {
  it('renders img when avatarUrl is provided', () => {
    render(<Avatar name="Alex Chen" avatarUrl={PHOTO} />);

    const photo = screen.getByAltText('Alex Chen');
    expect(photo).toHaveAttribute('src', PHOTO);
    expect(screen.queryByText('AC')).not.toBeInTheDocument();
  });

  it('accepts https URLs without sending a referrer', () => {
    render(<Avatar name="Alex Chen" avatarUrl="https://example.com/a.png" />);

    expect(screen.getByAltText('Alex Chen')).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('falls back to initials on img error', () => {
    render(<Avatar name="Alex Chen" avatarUrl={PHOTO} />);

    fireEvent.error(screen.getByAltText('Alex Chen'));

    expect(screen.queryByAltText('Alex Chen')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alex Chen' })).toHaveTextContent('AC');
  });

  it('tries a new photo after a previous one failed', () => {
    const { rerender } = render(<Avatar name="Alex Chen" avatarUrl={PHOTO} />);
    fireEvent.error(screen.getByAltText('Alex Chen'));

    rerender(<Avatar name="Alex Chen" avatarUrl="https://example.com/b.png" />);

    expect(screen.getByAltText('Alex Chen')).toHaveAttribute('src', 'https://example.com/b.png');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'http://example.com/a.png',
    '//example.com/a.png',
    '',
  ])('ignores the unsafe URL "%s" and shows initials', (url) => {
    render(<Avatar name="Alex Chen" avatarUrl={url} />);

    expect(screen.queryByAltText('Alex Chen')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alex Chen' })).toHaveTextContent('AC');
  });
});

describe('Avatar accessibility', () => {
  it('has role="img" and aria-label with full name', () => {
    render(<Avatar name="Alex Chen" />);

    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Alex Chen');
  });

  it('initials text span has aria-hidden="true"', () => {
    render(<Avatar name="Alex Chen" />);

    expect(screen.getByText('AC')).toHaveAttribute('aria-hidden', 'true');
  });

  it('accepts aria-hidden prop for decorative usage', () => {
    render(<Avatar name="Alex Chen" aria-hidden />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('AC').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('AC').parentElement).not.toHaveAttribute('aria-label');
  });

  it('keeps the same accessible name when a photo fails to load', () => {
    render(<Avatar name="Alex Chen" avatarUrl={PHOTO} />);
    const before = screen.getByLabelText('Alex Chen');

    fireEvent.error(screen.getByAltText('Alex Chen'));

    expect(before).toHaveAttribute('aria-label', 'Alex Chen');
  });

  it.each([
    ['initials', undefined],
    ['photo', PHOTO],
  ])('has no accessibility violations in %s mode', async (_mode, avatarUrl) => {
    const { container } = render(<Avatar name="Alex Chen" avatarUrl={avatarUrl} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
