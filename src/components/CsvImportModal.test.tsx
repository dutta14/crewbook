import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as membersModule from '../data/members';
import { listMembers } from '../data/members';
import { useEncryptedStorage } from '../hooks/useEncryptedStorage';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { CSV_TEMPLATE, CSV_TEMPLATE_FILENAME } from '../utils/csvTemplate';
import { CsvImportModal } from './CsvImportModal';

vi.mock('../data/members', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/members')>();
  return { ...actual, addMember: vi.fn(actual.addMember) };
});

const addMemberSpy = vi.mocked(membersModule.addMember);

const HEADER = 'name,role,level,startDate,email,manager,status';
const FIVE_PEOPLE = `${HEADER}
Ada Lovelace,Engineer,L5,2021-01-04,ada@example.com,,active
Grace Hopper,Staff Engineer,L7,2019-06-10,grace@example.com,,active
Alan Turing,Researcher,L6,2020-02-17,alan@example.com,,on_leave
Edsger Dijkstra,Engineer,L4,2022-09-05,edsger@example.com,,new_hire
Barbara Liskov,Designer,L5,2023-03-20,barbara@example.com,,departing
`;
const MIXED = `${HEADER}
Ada Lovelace,Engineer,L5,2021-01-04,ada@example.com,,active
,Engineer,L5,2021-01-04,nobody@example.com,,active
Alan Turing,Researcher,L6,2020-02-17,not-an-email,,active
Grace Hopper,Staff Engineer,L7,2019-06-10,grace@example.com,,active
`;

const csvFile = (contents: string, name = 'team-roster.csv') =>
  new File([contents], name, { type: 'text/csv' });

function Harness() {
  const [isOpen, setIsOpen] = useState(false);
  const storage = useEncryptedStorage();
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Import CSV
      </button>
      <CsvImportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <ul aria-label="Saved members">
        {listMembers(storage).map((member) => (
          <li key={member.id}>{member.name}</li>
        ))}
      </ul>
    </>
  );
}

async function openModal() {
  const user = userEvent.setup();
  const view = renderWithProviders(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Import CSV' });
  await user.click(trigger);
  return { user, trigger, ...view };
}

const fileInput = () => screen.getByLabelText('Choose a .csv file') as HTMLInputElement;
const dataRows = () => screen.getAllByTestId('csv-preview-row');
const importButton = () => screen.getByRole('button', { name: /^Import \d+ members?$/ });
const savedNames = () =>
  within(screen.getByRole('list', { name: 'Saved members' }))
    .queryAllByRole('listitem')
    .map((item) => item.textContent);

async function upload(user: ReturnType<typeof userEvent.setup>, contents: string, name?: string) {
  await user.upload(fileInput(), csvFile(contents, name));
  await screen.findByRole('heading', { name: 'Step 2: Preview and import' });
}

beforeEach(() => {
  addMemberSpy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CsvImportModal', () => {
  it('modal opens with Step 1 upload view', async () => {
    await openModal();

    const dialog = screen.getByRole('dialog', { name: 'Import team from CSV' });
    expect(within(dialog).getByRole('heading', { name: 'Step 1: Upload file' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: /^Upload CSV file/ })).toBeVisible();
    expect(within(dialog).getByText('Drop a .csv file or click to browse')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('modal has role="dialog" with focus trap and Escape to close', async () => {
    const { user, trigger } = await openModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Import team from CSV');

    for (let press = 0; press < 8; press += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('file input accepts only .csv files', async () => {
    await openModal();

    expect(fileInput()).toHaveAttribute('type', 'file');
    expect(fileInput()).toHaveAttribute('accept', '.csv');
  });

  it('the drop zone opens the file picker from the keyboard', async () => {
    const { user } = await openModal();
    const click = vi.spyOn(fileInput(), 'click');
    const zone = screen.getByRole('button', { name: /^Upload CSV file/ });

    zone.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(click).toHaveBeenCalledTimes(2);
  });

  it('preview table shows all parsed rows after upload', async () => {
    const { user } = await openModal();

    await upload(user, FIVE_PEOPLE);

    expect(screen.getByRole('table', { name: 'CSV preview: 5 rows' })).toBeInTheDocument();
    expect(dataRows()).toHaveLength(5);
    expect(within(dataRows()[0]).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(dataRows()[2]).getByText('on_leave')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Select',
      'Name',
      'Role',
      'Level',
      'Email',
      'Status',
      'Validation',
    ]);
    expect(screen.getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(
      true,
    );
  });

  it('files dropped on the drop zone are previewed', async () => {
    await openModal();
    const zone = screen.getByRole('button', { name: /^Upload CSV file/ });

    fireEvent.dragEnter(zone);
    expect(zone).toHaveAttribute('data-dragging', 'true');
    fireEvent.drop(zone, { dataTransfer: { files: [csvFile(FIVE_PEOPLE)] } });

    expect(
      await screen.findByRole('heading', { name: 'Step 2: Preview and import' }),
    ).toBeVisible();
    expect(dataRows()).toHaveLength(5);
  });

  it('invalid rows are unchecked by default', async () => {
    const { user } = await openModal();

    await upload(user, MIXED);

    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, false, false, true]);
    expect(within(dataRows()[1]).getByText('Missing name')).toBeInTheDocument();
    expect(within(dataRows()[2]).getByText('Invalid email format')).toBeInTheDocument();
  });

  it('invalid rows explain the problem in text that their checkbox points to', async () => {
    const { user } = await openModal();

    await upload(user, MIXED);

    const box = screen.getByRole('checkbox', { name: 'Select row 2 for import' });
    expect(box).toBeDisabled();
    expect(box).toHaveAccessibleDescription('Missing name');
    expect(screen.getByRole('checkbox', { name: 'Select Ada Lovelace for import' })).toBeEnabled();
  });

  it('user can deselect valid rows', async () => {
    const { user } = await openModal();
    await upload(user, FIVE_PEOPLE);

    const box = screen.getByRole('checkbox', { name: 'Select Ada Lovelace for import' });
    await user.click(box);
    expect(box).not.toBeChecked();
    await user.click(box);

    expect(box).toBeChecked();
  });

  it('import button shows count of checked valid rows', async () => {
    const { user } = await openModal();
    await upload(user, FIVE_PEOPLE);
    expect(importButton()).toHaveTextContent('Import 5 members');

    await user.click(screen.getByRole('checkbox', { name: 'Select Ada Lovelace for import' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Grace Hopper for import' }));

    expect(importButton()).toHaveTextContent('Import 3 members');
  });

  it('import button uses the singular for one member', async () => {
    const { user } = await openModal();
    await upload(user, `${HEADER}\nAda Lovelace,,,,,,`);

    expect(importButton()).toHaveTextContent('Import 1 member');
  });

  it('import button is disabled when no valid rows are selected', async () => {
    const { user } = await openModal();
    await upload(user, `${HEADER}\n,Engineer,,,,,`);

    expect(importButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(importButton());

    expect(addMemberSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('a file with only headers previews zero rows and cannot be imported', async () => {
    const { user } = await openModal();

    await upload(user, `${HEADER}\n`);

    expect(screen.getByRole('table', { name: 'CSV preview: 0 rows' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('csv-preview-row')).toHaveLength(0);
    expect(importButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('import creates only checked valid members', async () => {
    const { user } = await openModal();
    await upload(user, MIXED);
    await user.click(screen.getByRole('checkbox', { name: 'Select Grace Hopper for import' }));

    await user.click(importButton());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(savedNames()).toEqual(['Ada Lovelace']);
    expect(addMemberSpy).toHaveBeenCalledTimes(1);
  });

  it('summary toast shows correct imported/skipped counts', async () => {
    const { user } = await openModal();
    await upload(user, MIXED);

    await user.click(importButton());

    expect(await screen.findByText('Imported 2 of 4 members (2 skipped)')).toBeInTheDocument();
    expect(savedNames()).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });

  it('summary toast omits the skipped count when every row was imported', async () => {
    const { user } = await openModal();
    await upload(user, FIVE_PEOPLE);

    await user.click(importButton());

    expect(await screen.findByText('Imported 5 of 5 members')).toBeInTheDocument();
    expect(savedNames()).toHaveLength(5);
  });

  it('a row that fails to save is counted as skipped and the rest are kept', async () => {
    const actual = await vi.importActual<typeof import('../data/members')>('../data/members');
    addMemberSpy.mockImplementation((input, storage) =>
      input.name === 'Alan Turing'
        ? Promise.reject(new Error('write failed'))
        : actual.addMember(input, storage),
    );
    const { user } = await openModal();
    await upload(user, FIVE_PEOPLE);

    await user.click(importButton());

    expect(await screen.findByText('Imported 4 of 5 members (1 skipped)')).toBeInTheDocument();
    expect(savedNames()).not.toContain('Alan Turing');
    expect(savedNames()).toHaveLength(4);
    addMemberSpy.mockImplementation(actual.addMember);
  });

  it('links imported members to an existing manager by name', async () => {
    const boss = createMember({ id: 'boss', name: 'Margaret Hamilton' });
    const user = userEvent.setup();
    const onSaved = vi.fn<(members: ReturnType<typeof listMembers>) => void>();
    function Probe() {
      onSaved(listMembers(useEncryptedStorage()));
      return null;
    }
    renderWithProviders(
      <>
        <Probe />
        <CsvImportModal isOpen onClose={() => undefined} />
      </>,
      { initialData: { members: [boss] } },
    );

    await upload(user, `${HEADER}\nAda Lovelace,,,,,margaret hamilton,`);
    await user.click(importButton());

    await waitFor(() => expect(onSaved.mock.lastCall?.[0]).toHaveLength(2));
    const saved = onSaved.mock.lastCall?.[0] ?? [];
    expect(saved.find((member) => member.name === 'Ada Lovelace')?.manager).toBe('boss');
  });

  it('template download link triggers file download', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const createObjectURL = vi.fn(() => 'blob:template');
    const revokeObjectURL = vi.fn();
    // jsdom has no object URL support, so the methods are added and removed around this test.
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<CsvImportModal isOpen onClose={() => undefined} />);

    const link = screen.getByRole('link', { name: 'Download CSV template' });
    expect(link).toHaveAttribute('download', CSV_TEMPLATE_FILENAME);
    await user.click(link);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(await blob.text()).toBe(CSV_TEMPLATE);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:template');
    anchorClick.mockRestore();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('step transition announces change via aria-live', async () => {
    const { user } = await openModal();
    const region = screen.getByRole('dialog').querySelector('[aria-live="polite"]');
    expect(region).toBeEmptyDOMElement();

    await upload(user, FIVE_PEOPLE);

    expect(region).toHaveTextContent(
      'team-roster.csv selected. Step 2: Preview and import. 5 rows found.',
    );
    expect(screen.getByRole('heading', { name: 'Step 2: Preview and import' })).toHaveFocus();
  });

  it('row checkboxes have aria-label "Select [Name] for import"', async () => {
    const { user } = await openModal();

    await upload(user, FIVE_PEOPLE);

    expect(screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'))).toEqual([
      'Select Ada Lovelace for import',
      'Select Grace Hopper for import',
      'Select Alan Turing for import',
      'Select Edsger Dijkstra for import',
      'Select Barbara Liskov for import',
    ]);
  });

  it('rejects a non-csv file with an inline message and stays on step 1', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<CsvImportModal isOpen onClose={() => undefined} />);

    await user.upload(fileInput(), new File(['a'], 'roster.xlsx', { type: 'application/xlsx' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please upload a .csv file');
    expect(screen.getByRole('heading', { name: 'Step 1: Upload file' })).toBeVisible();
  });

  it('rejects a file over 1 MB without reading it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CsvImportModal isOpen onClose={() => undefined} />);
    const big = csvFile('name');
    Object.defineProperty(big, 'size', { value: 1024 * 1024 + 1 });

    await user.upload(fileInput(), big);

    expect(await screen.findByRole('alert')).toHaveTextContent('File is too large');
  });

  it('shows an inline error when the file has no name column', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CsvImportModal isOpen onClose={() => undefined} />);

    await user.upload(fileInput(), csvFile('role,level\nEngineer,L5'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not parse file. Ensure it is a valid CSV.',
    );
  });

  it('cancel discards the preview and the next opening starts at step 1', async () => {
    const { user } = await openModal();
    await upload(user, FIVE_PEOPLE);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(savedNames()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));

    expect(screen.getByRole('heading', { name: 'Step 1: Upload file' })).toBeVisible();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('has no axe violations on either step', async () => {
    const { user } = await openModal();
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();

    await upload(user, MIXED);

    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
  });
});
