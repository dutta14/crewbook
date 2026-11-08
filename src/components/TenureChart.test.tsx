import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { createMember } from '../test-utils/factories';
import type { TeamMember } from '../types';
import type { TenureSortField } from '../types/tenure';
import { buildTenureBars, buildTenureScale, sortTenureBars } from '../utils/tenure';
import { TenureChart } from './TenureChart';

const TODAY = new Date(2026, 10, 8);

const ALEX = createMember({ id: 'a', name: 'Alex Chen', startDate: '2023-03-13' });
const BEA = createMember({ id: 'b', name: 'Bea Okafor', startDate: '2019-01-07' });
const CAL = createMember({
  id: 'c',
  name: 'Cal Reyes',
  startDate: '2021-06-01',
  status: 'departing',
  departureDate: '2027-02-26',
});
const DEE = createMember({
  id: 'd',
  name: 'Dee Park',
  startDate: '2026-09-14',
  status: 'new_hire',
});

function renderChart(
  members: TeamMember[],
  { sortField = 'startDate', onSortChange = vi.fn() } = {} as {
    sortField?: TenureSortField;
    onSortChange?: (field: TenureSortField) => void;
  },
) {
  const unsorted = buildTenureBars(members, TODAY);
  return render(
    <TenureChart
      bars={sortTenureBars(unsorted, sortField)}
      timeScale={buildTenureScale(unsorted, TODAY)}
      today={TODAY}
      sortField={sortField}
      onSortChange={onSortChange}
    />,
  );
}

const barsIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<SVGGElement>('[data-testid="tenure-bar"]'));
const widthOf = (bar: Element) => Number(bar.querySelector('rect')?.getAttribute('width'));
const namesInOrder = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('rowheader')[0].textContent);

describe('TenureChart', () => {
  it('labels the chart as an image', () => {
    renderChart([ALEX]);

    expect(screen.getByRole('img', { name: 'Team tenure timeline chart' })).toBeInTheDocument();
  });

  it('gives screen readers a table with name, start, end, status and tenure', () => {
    renderChart([ALEX, CAL, DEE], { sortField: 'name' });

    const table = screen.getByRole('table', { name: 'Team tenure by person' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Name', 'Start Date', 'End Date', 'Status', 'Tenure']);
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Alex Chen');
    expect(rows[1]).toHaveTextContent('Present');
    expect(rows[1]).toHaveTextContent('Active');
    expect(rows[1]).toHaveTextContent('3y 7m');
    expect(rows[2]).toHaveTextContent('Cal Reyes');
    expect(rows[2]).toHaveTextContent('Feb 26, 2027');
    expect(rows[2]).toHaveTextContent('Departing');
    expect(rows[3]).toHaveTextContent('New hire');
    expect(rows[3]).toHaveTextContent('1m');
  });

  it('says when a departing member has no expected departure date', () => {
    renderChart([createMember({ id: 'x', name: 'Xi Lin', status: 'departing' })]);

    expect(within(screen.getByRole('table')).getByText('Not set')).toBeInTheDocument();
  });

  it('draws one bar for each team member', () => {
    const { container } = renderChart([ALEX, BEA, CAL, DEE]);

    expect(barsIn(container)).toHaveLength(4);
  });

  it('draws bars in proportion to tenure', () => {
    const { container } = renderChart([ALEX, BEA], { sortField: 'name' });

    const [alex, bea] = barsIn(container).map(widthOf);
    // Alex: 2023-03-13 to 2026-11-08 (1335 days). Bea: 2019-01-07 to 2026-11-08 (2862 days).
    expect(bea / alex).toBeCloseTo(2862 / 1335, 2);
  });

  it('draws a very short tenure at the minimum bar width', () => {
    const { container } = renderChart([
      createMember({ id: 'z', name: 'Zed', startDate: '2026-11-08' }),
    ]);

    expect(widthOf(barsIn(container)[0])).toBe(40);
  });

  it('draws active members with a solid bar', () => {
    const { container } = renderChart([ALEX]);

    const [bar] = barsIn(container);
    expect(bar).toHaveAttribute('data-status', 'active');
    expect(bar).toHaveClass('tenure-bar--active');
    expect(bar.querySelector('rect')).not.toHaveAttribute('stroke-dasharray');
  });

  it('draws new hires with a dashed bar', () => {
    const { container } = renderChart([ALEX, DEE], { sortField: 'name' });

    const bar = barsIn(container)[1];
    expect(bar).toHaveClass('tenure-bar--new-hire');
    expect(bar.querySelector('rect')).toHaveAttribute('stroke-dasharray', '4 3');
  });

  it('draws a hire who has not started yet from today out to the start date', () => {
    const upcoming = createMember({
      id: 'u',
      name: 'Uma Rao',
      startDate: '2027-01-04',
      status: 'new_hire',
    });
    const { container } = renderChart([ALEX, upcoming], { sortField: 'name' });

    const [alexBar, umaBar] = barsIn(container);
    const alexRect = alexBar.querySelector('rect');
    const umaRect = umaBar.querySelector('rect');
    const todayX = Number(alexRect?.getAttribute('x')) + Number(alexRect?.getAttribute('width'));
    expect(Number(umaRect?.getAttribute('x'))).toBeCloseTo(todayX, 5);
    expect(Number(umaRect?.getAttribute('width'))).toBeGreaterThanOrEqual(40);
    expect(within(screen.getByRole('table')).getByText('Not started')).toBeInTheDocument();
  });

  it('puts an end cap on the bars of departing members only', () => {
    const { container } = renderChart([ALEX, CAL]);

    expect(container.querySelectorAll('[data-testid="tenure-end-cap"]')).toHaveLength(1);
    const departing = barsIn(container).find((bar) => bar.dataset.status === 'departing');
    expect(departing?.querySelector('[data-testid="tenure-end-cap"]')).not.toBeNull();
  });

  it('ends a departing bar at the expected departure date', () => {
    const { container } = renderChart([ALEX, CAL], { sortField: 'name' });

    const [alex, cal] = barsIn(container);
    const end = (bar: Element) =>
      Number(bar.querySelector('rect')?.getAttribute('x')) + widthOf(bar);
    expect(end(cal)).toBeGreaterThan(end(alex));
  });

  it('hides the bars from assistive technology', () => {
    const { container } = renderChart([ALEX, CAL]);

    barsIn(container).forEach((bar) => {
      expect(bar.closest('[aria-hidden="true"]')).not.toBeNull();
    });
  });

  it('labels the sort control', () => {
    renderChart([ALEX]);

    const select = screen.getByLabelText('Sort by');
    expect(select.tagName).toBe('SELECT');
    expect(
      within(select as HTMLSelectElement)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Start date', 'Tenure length', 'Name']);
  });

  it('orders by start date, earliest first', () => {
    renderChart([ALEX, BEA, CAL], { sortField: 'startDate' });

    expect(namesInOrder()).toEqual(['Bea Okafor', 'Cal Reyes', 'Alex Chen']);
  });

  it('orders by tenure, longest first', () => {
    // Fay started before Alex but is leaving after seven months, so her tenure is the shortest.
    const fay = createMember({
      id: 'f',
      name: 'Fay Ito',
      startDate: '2021-06-01',
      status: 'departing',
      departureDate: '2022-01-01',
    });
    renderChart([ALEX, BEA, fay], { sortField: 'tenureLength' });

    expect(namesInOrder()).toEqual(['Bea Okafor', 'Alex Chen', 'Fay Ito']);
  });

  it('orders by name, A to Z', () => {
    renderChart([CAL, ALEX, BEA], { sortField: 'name' });

    expect(namesInOrder()).toEqual(['Alex Chen', 'Bea Okafor', 'Cal Reyes']);
  });

  it('reports the chosen sort field', async () => {
    const onSortChange = vi.fn();
    renderChart([ALEX, BEA], { onSortChange });

    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'Name');

    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  it('shows the person, tenure, start month and status while a bar is hovered', () => {
    const { container } = renderChart([ALEX, BEA], { sortField: 'name' });
    const [alexBar] = barsIn(container);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(alexBar);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Alex Chen — 3yr 7mo (Start: Mar 2023) · Active',
    );

    fireEvent.mouseLeave(alexBar);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('says a hire has not started yet in the tooltip', () => {
    const upcoming = createMember({
      id: 'u',
      name: 'Uma Rao',
      startDate: '2027-01-04',
      status: 'new_hire',
    });
    const { container } = renderChart([upcoming]);

    fireEvent.mouseEnter(barsIn(container)[0]);

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Uma Rao — not started yet (Start: Jan 2027) · New hire',
    );
  });

  it('marks today with a dashed line that assistive technology skips', () => {
    renderChart([ALEX]);

    const marker = screen.getByTestId('tenure-today-marker');
    expect(marker).toHaveAttribute('aria-hidden', 'true');
    expect(marker.querySelector('line')).toHaveClass('tenure-chart__today');
    expect(marker).toHaveTextContent('Today');
  });

  it('renders a single team member', () => {
    const { container } = renderChart([ALEX]);

    expect(barsIn(container)).toHaveLength(1);
    expect(namesInOrder()).toEqual(['Alex Chen']);
  });

  it('renders active, on leave, new hire and departing members together', () => {
    const away = createMember({ id: 'o', name: 'Ola Berg', status: 'on_leave' });
    const { container } = renderChart([ALEX, away, CAL, DEE]);

    expect(barsIn(container).map((bar) => bar.dataset.status)).toEqual(
      expect.arrayContaining(['active', 'on_leave', 'departing', 'new_hire']),
    );
  });

  it('shows an empty state when there is no one on the team', () => {
    renderChart([]);

    expect(
      screen.getByRole('heading', { name: 'Add team members to see tenure data' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderChart([ALEX, BEA, CAL, DEE]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
