import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import type { GraphEdge, GraphNode } from '../types/connection';
import { NetworkGraph } from './NetworkGraph';

const node = (id: string, name: string): GraphNode => ({ id, name, x: 0, y: 0, color: '#0f766e' });

const NODES = [
  node('a', 'Alex Chen'),
  node('b', 'Priya Nair'),
  node('c', 'Sam Okoye'),
  node('d', 'Dana Whitfield-Montgomery'),
];
const EDGES: GraphEdge[] = [
  { source: 'a', target: 'b', relationship: 'mentor' },
  { source: 'b', target: 'c', relationship: 'collaborator' },
];

// Positions are computed in one go, as for visitors who prefer reduced motion.
const reduceMotion = (reduce: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

afterEach(() => vi.unstubAllGlobals());

describe('NetworkGraph', () => {
  it('renders an SVG with a node for each person', () => {
    reduceMotion(true);
    const { container } = render(<NetworkGraph nodes={NODES} edges={EDGES} />);

    expect(container.querySelector('svg')).toBeInTheDocument();
    for (const { id } of NODES) expect(screen.getByTestId(`graph-node-${id}`)).toBeInTheDocument();
    expect(container.querySelectorAll('.network-node')).toHaveLength(4);
  });

  it('labels each node with its name, shortened when long, and draws names as SVG text', () => {
    reduceMotion(true);
    const { container } = render(<NetworkGraph nodes={NODES} edges={EDGES} />);

    expect(screen.getByText('Alex Chen').tagName).toBe('text');
    expect(screen.getByText('Dana Whitfield-…')).toBeInTheDocument();
    expect(container.querySelector('svg')?.innerHTML).not.toContain('<script');
  });

  it('renders markup in a name as plain text', () => {
    reduceMotion(true);
    const evil = node('x', '<img src=x onerror=alert(1)>');
    const { container } = render(<NetworkGraph nodes={[evil]} edges={[]} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x/).tagName).toBe('text');
  });

  it('renders an edge for each connection with its relationship as a hover label', () => {
    reduceMotion(true);
    render(<NetworkGraph nodes={NODES} edges={EDGES} />);

    expect(screen.getAllByTestId('graph-edge')).toHaveLength(2);
    expect(screen.getByText('Mentor')).toBeInTheDocument();
    expect(screen.getByText('Collaborator')).toBeInTheDocument();
  });

  it('highlights a clicked node and its neighbours and dims everyone else', async () => {
    reduceMotion(true);
    const user = userEvent.setup();
    render(<NetworkGraph nodes={NODES} edges={EDGES} />);

    await user.click(screen.getByTestId('graph-node-a'));

    expect(screen.getByTestId('graph-node-a')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('graph-node-b')).not.toHaveAttribute('data-dimmed');
    expect(screen.getByTestId('graph-node-c')).toHaveAttribute('data-dimmed', 'true');
    expect(screen.getByTestId('graph-node-d')).toHaveAttribute('data-dimmed', 'true');
    const [aToB, bToC] = screen.getAllByTestId('graph-edge');
    expect(aToB).not.toHaveAttribute('data-dimmed');
    expect(bToC).toHaveAttribute('data-dimmed', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Alex Chen selected. 1 connected person highlighted.',
    );
  });

  it('restores everything when the background is clicked', async () => {
    reduceMotion(true);
    const user = userEvent.setup();
    render(<NetworkGraph nodes={NODES} edges={EDGES} />);
    await user.click(screen.getByTestId('graph-node-a'));

    await user.click(screen.getByTestId('graph-background'));

    for (const { id } of NODES) {
      expect(screen.getByTestId(`graph-node-${id}`)).not.toHaveAttribute('data-dimmed');
      expect(screen.getByTestId(`graph-node-${id}`)).not.toHaveAttribute('data-selected');
    }
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('moves the selection when another node is clicked', async () => {
    reduceMotion(true);
    const user = userEvent.setup();
    render(<NetworkGraph nodes={NODES} edges={EDGES} />);
    await user.click(screen.getByTestId('graph-node-a'));

    await user.click(screen.getByTestId('graph-node-c'));

    expect(screen.getByTestId('graph-node-a')).not.toHaveAttribute('data-selected');
    expect(screen.getByTestId('graph-node-c')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('graph-node-a')).toHaveAttribute('data-dimmed', 'true');
  });

  it('exposes the graph as an image with a descriptive label', () => {
    reduceMotion(true);
    render(<NetworkGraph nodes={NODES} edges={EDGES} />);

    expect(screen.getByRole('img', { name: 'Team connection network graph' })).toBeInTheDocument();
  });

  it('settles over animation frames when motion is allowed', async () => {
    reduceMotion(false);
    render(<NetworkGraph nodes={NODES} edges={EDGES} />);
    const before = screen.getByTestId('graph-node-a').getAttribute('transform');

    await vi.waitFor(() =>
      expect(screen.getByTestId('graph-node-a').getAttribute('transform')).not.toBe(before),
    );
  });

  it('has no accessibility violations', async () => {
    reduceMotion(true);
    const { container } = render(<NetworkGraph nodes={NODES} edges={EDGES} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
