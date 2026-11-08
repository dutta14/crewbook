import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import { createMember } from '../test-utils/factories';
import { renderWithProviders } from '../test-utils/renderWithProviders';
import { FlightRiskIndicator } from './FlightRiskIndicator';
import { RosterAvatar } from './RosterAvatar';

describe('FlightRiskIndicator', () => {
  it('renders nothing for none', () => {
    const { container } = render(<FlightRiskIndicator level="none" />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['low', 'dot-g'],
    ['medium', 'dot-a'],
    ['high', 'dot-r'],
  ] as const)('draws a %s dot with a non-semantic class and a text name', (level, cls) => {
    const { container } = render(<FlightRiskIndicator level={level} size={10} />);

    const mark = container.querySelector(`.${cls}`);
    expect(mark).toHaveStyle({ width: '10px', height: '10px' });
    expect(screen.getByText(/^Flight risk: /)).toHaveClass('sr-only');
  });

  it('puts the level in no attribute, so DevTools shows no assessment', () => {
    const { container } = render(<FlightRiskIndicator level="high" isLabelVisible />);

    const attributes = [container, ...container.querySelectorAll('*')].flatMap((element) =>
      Array.from(element.attributes).map((attribute) => `${attribute.name}=${attribute.value}`),
    );
    expect(attributes.join(' ')).not.toMatch(/high|risk|data-|title|aria-label/i);
  });

  it('shows the level as a hover label only when asked, hidden from assistive technology', () => {
    const { rerender } = render(<FlightRiskIndicator level="medium" />);
    expect(screen.queryByText('Medium')).not.toBeInTheDocument();

    rerender(<FlightRiskIndicator level="medium" isLabelVisible />);

    expect(screen.getByText('Medium')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('RosterAvatar', () => {
  const ALEX = createMember({ id: 'alex', name: 'Alex Chen' });
  const renderAvatar = (flightRisk: unknown[], settings?: Record<string, string>) =>
    renderWithProviders(<RosterAvatar member={ALEX} />, {
      initialData: { members: [ALEX], ...(settings ? { settings } : {}) },
      initialPrivateData: { flightRisk },
    });
  const note = (flightRisk: string) => ({
    id: flightRisk,
    engineerId: 'alex',
    text: 'x',
    flightRisk,
    createdAt: '2025-01-01T00:00:00.000Z',
  });

  it('shows the dot for the latest level and reveals its label on hover', async () => {
    const user = userEvent.setup();
    const { container } = renderAvatar([note('high')]);

    expect(screen.getByText('Flight risk: High')).toBeInTheDocument();
    await user.hover(container.querySelector('.roster-avatar') as Element);
    expect(screen.getByText('High', { selector: '[aria-hidden]' })).toBeInTheDocument();
    await user.unhover(container.querySelector('.roster-avatar') as Element);
    expect(screen.queryByText('High', { selector: '[aria-hidden]' })).not.toBeInTheDocument();
  });

  it('shows no dot when the level is none', () => {
    renderAvatar([note('none')]);

    expect(screen.queryByText(/Flight risk/)).not.toBeInTheDocument();
  });

  it('shows no dot when the manager has hidden risk indicators', () => {
    renderAvatar([note('high')], { hideRiskIndicators: 'true' });

    expect(screen.queryByText(/Flight risk/)).not.toBeInTheDocument();
  });

  it('has no accessibility violations with a dot', async () => {
    const { container } = renderAvatar([note('medium')]);

    expect(await axe(container)).toHaveNoViolations();
  });
});
