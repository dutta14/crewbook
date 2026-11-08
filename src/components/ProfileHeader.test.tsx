import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { createMember } from '../test-utils/factories';
import { ProfileHeader } from './ProfileHeader';

const member = () =>
  createMember({
    name: 'Alex Chen',
    role: 'Software Engineer',
    level: 'L4',
    status: 'on_leave',
    startDate: '2023-03-13',
    email: 'alex.chen@example.com',
  });

describe('ProfileHeader', () => {
  it('renders profile header with name, role, level, status badge', () => {
    render(<ProfileHeader member={member()} onEdit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alex Chen');
    expect(screen.getByText('Software Engineer · L4')).toBeInTheDocument();
    expect(screen.getByText('On leave')).toBeInTheDocument();
  });

  it('displays avatar with correct initials, hidden from assistive technology', () => {
    render(<ProfileHeader member={member()} onEdit={vi.fn()} />);

    expect(screen.getByText('AC')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Alex Chen' })).not.toBeInTheDocument();
  });

  it('shows the member photo in the avatar when they have an avatarUrl', () => {
    const photo = 'data:image/png;base64,iVBORw0KGgo=';
    render(<ProfileHeader member={{ ...member(), avatarUrl: photo }} onEdit={vi.fn()} />);

    expect(screen.getByAltText('Alex Chen')).toHaveAttribute('src', photo);
  });

  it('shows start date and email in header, with the email as a mailto link', () => {
    render(<ProfileHeader member={member()} onEdit={vi.fn()} />);

    expect(screen.getByText('Mar 13, 2023')).toHaveAttribute('datetime', '2023-03-13');
    expect(screen.getByRole('link', { name: 'alex.chen@example.com' })).toHaveAttribute(
      'href',
      'mailto:alex.chen@example.com',
    );
  });

  it('renders an unsafe email as plain text instead of a link', () => {
    render(
      <ProfileHeader member={{ ...member(), email: 'javascript:alert(1)' }} onEdit={vi.fn()} />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
  });

  it('renders the person name as h1', () => {
    render(<ProfileHeader member={member()} onEdit={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeInTheDocument();
  });

  it('gives the edit button the aria-label "Edit [Name]\'s profile" and calls onEdit', async () => {
    const onEdit = vi.fn();
    render(<ProfileHeader member={member()} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole('button', { name: "Edit Alex Chen's profile" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('only shows the delete button when a handler is provided', async () => {
    const onDelete = vi.fn();
    const { rerender } = render(<ProfileHeader member={member()} onEdit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete Alex Chen' })).not.toBeInTheDocument();

    rerender(<ProfileHeader member={member()} onEdit={vi.fn()} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Alex Chen' }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('omits empty role, level, date and email without leaving stray separators', () => {
    render(
      <ProfileHeader
        member={{ ...member(), role: '', level: '', email: '', startDate: 'not a date' }}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Started/)).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ProfileHeader member={member()} onEdit={vi.fn()} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
