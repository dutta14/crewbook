import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import type { CustomFieldDefinition } from '../types/customField';
import { CustomFieldDisplay } from './CustomFieldDisplay';

const definitions: CustomFieldDefinition[] = [
  { id: 'squad', name: 'Squad', type: 'text', order: 0 },
  { id: 'size', name: 'Shirt size', type: 'select', options: ['S'], order: 1 },
  { id: 'since', name: 'Certified', type: 'date', order: 2 },
  { id: 'wiki', name: 'Wiki page', type: 'url', order: 3 },
];

describe('CustomFieldDisplay', () => {
  it('renders nothing when no field is defined', () => {
    const { container } = render(<CustomFieldDisplay definitions={[]} values={{ a: 'x' }} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists every defined field in order, with its value as text', () => {
    render(
      <CustomFieldDisplay
        definitions={definitions}
        values={{ squad: '<b>Payments</b>', size: 'S' }}
      />,
    );

    const list = screen.getByRole('region', { name: 'Custom fields' });
    expect(
      within(list)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Squad', 'Shirt size', 'Certified', 'Wiki page']);
    expect(within(list).getByText('<b>Payments</b>')).toBeInTheDocument();
    expect(list.querySelector('b')).toBeNull();
  });

  it('shows a dash with "Not set" for screen readers when a value is empty or missing', () => {
    render(<CustomFieldDisplay definitions={definitions} values={{ squad: '' }} />);

    expect(screen.getAllByText('Not set')).toHaveLength(4);
    expect(screen.getAllByText('—')[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('formats a date and keeps the machine value', () => {
    render(<CustomFieldDisplay definitions={definitions} values={{ since: '2024-03-01' }} />);

    expect(screen.getByText('Mar 1, 2024')).toHaveAttribute('datetime', '2024-03-01');
  });

  it('opens a link in a new tab safely and says so', () => {
    render(
      <CustomFieldDisplay definitions={definitions} values={{ wiki: 'https://example.com/a' }} />,
    );

    const link = screen.getByRole('link', { name: /example\.com\/a/ });
    expect(link).toHaveAttribute('href', 'https://example.com/a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName('https://example.com/a (opens in new tab)');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <CustomFieldDisplay definitions={definitions} values={{ wiki: 'https://example.com/a' }} />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
