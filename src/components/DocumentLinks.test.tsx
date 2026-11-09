import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../data/errors';
import { createDocumentLink } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import type { DocumentLink } from '../types/document';
import { DocumentLinks } from './DocumentLinks';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const seeded = (): DocumentLink[] => [
  createDocumentLink({
    title: 'Q3 promo packet',
    url: 'https://docs.google.com/document/d/abc123',
    category: 'promo_packet',
    updatedAt: daysAgo(3),
  }),
  createDocumentLink({
    title: 'H1 self review',
    url: 'https://wiki.example.com/reviews/h1',
    category: 'self_review',
    updatedAt: daysAgo(70),
  }),
  createDocumentLink({
    title: 'Staff ladder',
    url: 'http://wiki.example.com/ladder',
    category: 'career_ladder',
    updatedAt: daysAgo(0),
  }),
];

function renderLinks(links: DocumentLink[] = seeded()) {
  const onAddLink = vi.fn().mockResolvedValue(undefined);
  const onEditLink = vi.fn().mockResolvedValue(undefined);
  const onRemoveLink = vi.fn().mockResolvedValue(undefined);
  const view = renderWithProviders(
    <DocumentLinks
      links={links}
      onAddLink={onAddLink}
      onEditLink={onEditLink}
      onRemoveLink={onRemoveLink}
    />,
  );
  return { ...view, onAddLink, onEditLink, onRemoveLink };
}

const openAddForm = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Add document link/ }));

const urlInput = () => screen.getByLabelText(/^Link/);
const titleInput = () => screen.getByLabelText(/^Title/);

afterEach(() => vi.restoreAllMocks());

describe('DocumentLinks', () => {
  it('renders document links grouped by category under a Documents heading', () => {
    renderLinks();

    expect(screen.getByRole('heading', { name: 'Documents' })).toBeInTheDocument();
    const promo = screen.getByRole('region', { name: /Promo Packets/ });
    expect(within(promo).getByRole('link', { name: /Q3 promo packet/ })).toBeInTheDocument();
    const reviews = screen.getByRole('region', { name: /Self Reviews/ });
    expect(within(reviews).getByRole('link', { name: /H1 self review/ })).toBeInTheDocument();
    expect(within(promo).queryByText('H1 self review')).toBeNull();
  });

  it('shows the title, the destination host and a relative date for each link', () => {
    renderLinks();

    const promo = screen.getByRole('region', { name: /Promo Packets/ });
    expect(within(promo).getByText('docs.google.com')).toBeInTheDocument();
    expect(within(promo).getByText('Updated 3 days ago')).toBeInTheDocument();
    expect(screen.getByText('Updated 2 months ago')).toBeInTheDocument();
    expect(screen.getByText('Updated today')).toBeInTheDocument();
  });

  it('opens a link in a new tab without leaking the opener or referrer', () => {
    renderLinks();

    const link = screen.getByRole('link', { name: /Q3 promo packet/ });
    expect(link).toHaveAttribute('href', 'https://docs.google.com/document/d/abc123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('title', 'https://docs.google.com/document/d/abc123');
  });

  it('tells screen readers that a link opens in a new tab', () => {
    renderLinks();

    expect(
      screen.getByRole('link', { name: /^Q3 promo packet\s*\(opens in new tab\)$/ }),
    ).toBeVisible();
  });

  it('does not render categories that have no links', () => {
    renderLinks();

    expect(screen.queryByRole('region', { name: /IDPs/ })).toBeNull();
    expect(screen.queryByRole('region', { name: /Other/ })).toBeNull();
  });

  it('collapses and expands a category from its header', async () => {
    const user = userEvent.setup();
    renderLinks();
    const toggle = screen.getByRole('button', { name: /Promo Packets/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'category-promo-packet-list');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows how many links each category holds', () => {
    renderLinks();

    expect(screen.getByRole('button', { name: /^Promo Packets\s*1\s*link$/ })).toBeInTheDocument();
  });

  it('shows an empty state when there are no documents in any category', () => {
    renderLinks([]);

    expect(screen.getByRole('heading', { name: 'No documents linked yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add document link/ })).toBeInTheDocument();
  });

  it('shows no form until "Add document link" is clicked', async () => {
    const user = userEvent.setup();
    renderLinks();
    expect(screen.queryByRole('form')).toBeNull();

    await openAddForm(user);

    expect(screen.getByRole('form', { name: 'Add document link' })).toBeInTheDocument();
    expect(titleInput()).toHaveFocus();
  });

  it('adds a link with the trimmed title, the URL and the chosen category', async () => {
    const user = userEvent.setup();
    const { onAddLink } = renderLinks();
    await openAddForm(user);

    await user.type(titleInput(), '  FY26 IDP ');
    await user.type(urlInput(), 'https://docs.google.com/document/d/idp');
    await user.selectOptions(screen.getByLabelText('Category'), 'idp');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddLink).toHaveBeenCalledWith({
      title: '  FY26 IDP ',
      url: 'https://docs.google.com/document/d/idp',
      category: 'idp',
    });
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox'],
    ['file:///etc/passwd'],
    ['ftp://files.example.com/a'],
    ['docs.google.com/document'],
    ['https://user:secret@example.com/a'],
  ])('rejects the link %s with an error linked to the field', async (bad) => {
    const user = userEvent.setup();
    const { onAddLink } = renderLinks();
    await openAddForm(user);

    await user.type(titleInput(), 'Bad link');
    await user.type(urlInput(), bad);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddLink).not.toHaveBeenCalled();
    expect(urlInput()).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('Enter a link that starts with https:// or http://');
    expect(urlInput().getAttribute('aria-describedby')).toBe(message.id);
    expect(urlInput()).toHaveFocus();
  });

  it('shows the URL error when the field loses focus', async () => {
    const user = userEvent.setup();
    renderLinks();
    await openAddForm(user);

    await user.type(urlInput(), 'not a url');
    await user.tab();

    expect(urlInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps Save disabled until both title and URL are filled in', async () => {
    const user = userEvent.setup();
    const { onAddLink } = renderLinks();
    await openAddForm(user);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.type(titleInput(), 'Only a title');
    expect(save).toBeDisabled();
    await user.type(urlInput(), 'https://example.com');
    expect(save).toBeEnabled();

    await user.clear(titleInput());
    await user.type(titleInput(), '   ');
    expect(save).toBeDisabled();
    expect(onAddLink).not.toHaveBeenCalled();
  });

  it('asks for a title when the field is left empty', async () => {
    const user = userEvent.setup();
    renderLinks();
    await openAddForm(user);

    await user.click(titleInput());
    await user.tab();

    expect(screen.getByText('Enter a title')).toBeInTheDocument();
    expect(titleInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('turns off autocomplete on the URL input and uses the url input type', async () => {
    const user = userEvent.setup();
    renderLinks();
    await openAddForm(user);

    expect(urlInput()).toHaveAttribute('type', 'url');
    expect(urlInput()).toHaveAttribute('autocomplete', 'off');
  });

  it('closes the add form with Escape and returns focus to the add button', async () => {
    const user = userEvent.setup();
    renderLinks();
    await openAddForm(user);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('form')).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Add document link/ })).toHaveFocus(),
    );
  });

  it('keeps the form open and shows the message when the store rejects the input', async () => {
    const user = userEvent.setup();
    const { onAddLink } = renderLinks();
    onAddLink.mockRejectedValueOnce(new ValidationError('Title must be 200 characters or fewer'));
    await openAddForm(user);

    await user.type(titleInput(), 'A title');
    await user.type(urlInput(), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Title must be 200 characters or fewer')).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  it('pre-fills the form when the edit icon is clicked', async () => {
    const user = userEvent.setup();
    renderLinks();

    await user.click(screen.getByRole('button', { name: 'Edit Q3 promo packet' }));

    expect(screen.getByRole('form', { name: 'Edit document link' })).toBeInTheDocument();
    expect(titleInput()).toHaveValue('Q3 promo packet');
    expect(urlInput()).toHaveValue('https://docs.google.com/document/d/abc123');
    expect(screen.getByLabelText('Category')).toHaveValue('promo_packet');
  });

  it('saves an edit with the updated values', async () => {
    const user = userEvent.setup();
    const { onEditLink } = renderLinks();
    await user.click(screen.getByRole('button', { name: 'Edit Q3 promo packet' }));

    await user.clear(titleInput());
    await user.type(titleInput(), 'Q4 promo packet');
    await user.selectOptions(screen.getByLabelText('Category'), 'other');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEditLink).toHaveBeenCalledWith(expect.any(String), {
      title: 'Q4 promo packet',
      url: 'https://docs.google.com/document/d/abc123',
      category: 'other',
    });
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
  });

  it('cancelling an edit returns focus to the edit button', async () => {
    const user = userEvent.setup();
    renderLinks();
    await user.click(screen.getByRole('button', { name: 'Edit Q3 promo packet' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit Q3 promo packet' })).toHaveFocus(),
    );
  });

  it('asks before removing a link and moves focus to the safe choice', async () => {
    const user = userEvent.setup();
    renderLinks();

    await user.click(screen.getByRole('button', { name: 'Remove Q3 promo packet' }));

    const prompt = screen.getByRole('alertdialog');
    expect(within(prompt).getByText('Remove this link?')).toBeInTheDocument();
    expect(prompt.getAttribute('aria-describedby')).toBe(
      within(prompt).getByText('Remove this link?').id,
    );
    expect(within(prompt).getByRole('button', { name: 'No' })).toHaveFocus();
  });

  it('removes the link when the prompt is confirmed', async () => {
    const user = userEvent.setup();
    const links = seeded();
    const { onRemoveLink } = renderLinks(links);
    await user.click(screen.getByRole('button', { name: 'Remove Q3 promo packet' }));

    await user.click(screen.getByRole('button', { name: 'Yes' }));

    expect(onRemoveLink).toHaveBeenCalledWith(links[0].id);
  });

  it('keeps the link when the prompt is cancelled', async () => {
    const user = userEvent.setup();
    const { onRemoveLink } = renderLinks();
    await user.click(screen.getByRole('button', { name: 'Remove Q3 promo packet' }));

    await user.click(screen.getByRole('button', { name: 'No' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onRemoveLink).not.toHaveBeenCalled();
  });

  it('closes the prompt with Escape and returns focus to the remove button', async () => {
    const user = userEvent.setup();
    renderLinks();
    await user.click(screen.getByRole('button', { name: 'Remove Q3 promo packet' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Q3 promo packet' })).toHaveFocus(),
    );
  });

  it('closes the prompt and keeps the link when removal fails', async () => {
    const user = userEvent.setup();
    const { onRemoveLink } = renderLinks();
    onRemoveLink.mockRejectedValueOnce(new Error('write failed'));
    await user.click(screen.getByRole('button', { name: 'Remove Q3 promo packet' }));

    await user.click(screen.getByRole('button', { name: 'Yes' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('link', { name: /Q3 promo packet/ })).toBeInTheDocument();
  });

  it('falls back to the added date when the updated date is damaged, then to "Unknown date"', () => {
    renderLinks([
      createDocumentLink({
        title: 'Fell back',
        updatedAt: 'garbage',
        createdAt: daysAgo(10),
        category: 'idp',
      }),
      createDocumentLink({
        title: 'No dates',
        updatedAt: 'garbage',
        createdAt: 'also garbage',
        category: 'other',
      }),
    ]);

    expect(screen.getByText('Updated 1 week ago')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
  });

  it('renders a title containing markup as plain text', () => {
    renderLinks([createDocumentLink({ title: '<img src=x onerror=alert(1)> plan' })]);

    expect(screen.getByRole('link', { name: /<img src=x onerror=alert\(1\)> plan/ })).toBeVisible();
    expect(document.querySelector('img')).toBeNull();
  });

  it('never makes a clickable link out of an unsafe stored URL', () => {
    renderLinks([createDocumentLink({ title: 'Tampered', url: 'javascript:alert(1)' })]);

    expect(screen.queryByRole('link', { name: /Tampered/ })).toBeNull();
    expect(screen.getByText('Tampered')).toBeInTheDocument();
  });

  it('has no accessibility violations with links, a form and a removal prompt open', async () => {
    const user = userEvent.setup();
    const { container } = renderLinks();
    await user.click(screen.getByRole('button', { name: 'Edit Q3 promo packet' }));
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Remove H1 self review' }));

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations in the empty state', async () => {
    const { container } = renderLinks([]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
