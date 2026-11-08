import { screen } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createActionItem, createMember, createMoodEntry, createNote } from './factories';
import { renderWithProviders } from './renderWithProviders';

describe('renderWithProviders', () => {
  it('renders the UI under a router starting at the requested route', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/roster" element={<p>Roster page</p>} />
      </Routes>,
      { route: '/roster' },
    );

    expect(screen.getByText('Roster page')).toBeInTheDocument();
  });

  it('makes router links work', () => {
    renderWithProviders(<Link to="/roster">Team</Link>);

    expect(screen.getByRole('link', { name: 'Team' })).toHaveAttribute('href', '/roster');
  });

  it('provides an unlocked storage seeded from initialData', () => {
    function MemberCount() {
      const { get, isUnlocked } = useEncryptedStorage();
      const members = get<unknown[]>('members') ?? [];
      return (
        <p>
          {isUnlocked ? 'unlocked' : 'locked'} with {members.length} members
        </p>
      );
    }

    renderWithProviders(<MemberCount />, { initialData: { members: [createMember()] } });

    expect(screen.getByText('unlocked with 1 members')).toBeInTheDocument();
  });

  it('provides the toast live region', () => {
    renderWithProviders(<p>App</p>);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('factories', () => {
  it('createMember returns a valid member with a unique id per call', () => {
    const first = createMember();
    const second = createMember();

    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({ name: 'Alex Chen', status: 'active', manager: null });
    expect(Number.isNaN(Date.parse(first.createdAt))).toBe(false);
  });

  it('createMember shallow-merges overrides', () => {
    const member = createMember({ name: 'Sam Rivera', status: 'on_leave' });

    expect(member).toMatchObject({
      name: 'Sam Rivera',
      status: 'on_leave',
      role: 'Software Engineer',
    });
  });

  it('createNote defaults to a shared note and accepts overrides', () => {
    expect(createNote().visibility).toBe('shared');
    expect(createNote({ visibility: 'private' }).visibility).toBe('private');
  });

  it('createActionItem defaults to an open item and accepts overrides', () => {
    expect(createActionItem().status).toBe('open');
    expect(createActionItem({ title: 'Ship it' }).title).toBe('Ship it');
  });

  it('createMoodEntry defaults to a valid score and accepts overrides', () => {
    expect(createMoodEntry().score).toBe(4);
    expect(createMoodEntry({ score: 1 }).score).toBe(1);
  });
});
