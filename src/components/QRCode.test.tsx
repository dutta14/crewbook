import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QRCode } from './QRCode';

describe('QRCode', () => {
  it('draws the whole link as an image labelled with that link', () => {
    const url = 'http://localhost/#/shared/abc.def';
    render(<QRCode url={url} />);

    const image = screen.getByRole('img', { name: `QR code linking to ${url}` });
    expect(image.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  it('always draws dark on white so it scans in dark mode', () => {
    render(<QRCode url="x" />);

    const image = screen.getByRole('img');
    expect(image.querySelector('rect')).toHaveAttribute('fill', '#ffffff');
    expect(image.querySelector('path')).toHaveAttribute('fill', '#000000');
  });

  it('draws a different code for a different link', () => {
    const { rerender } = render(<QRCode url="http://localhost/#/shared/one" />);
    const first = screen.getByRole('img').querySelector('path')?.getAttribute('d');

    rerender(<QRCode url="http://localhost/#/shared/two" />);

    expect(screen.getByRole('img').querySelector('path')?.getAttribute('d')).not.toBe(first);
  });

  it('says so instead of drawing a code when the link is too long', () => {
    render(<QRCode url={'a'.repeat(4000)} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'This link is too long for a QR code. Copy the link instead.',
    );
  });
});
