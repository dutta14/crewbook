import { describe, expect, it } from 'vitest';
import { highlightMatches, renderMarkdown } from './markdownRenderer';

const parse = (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
};

describe('renderMarkdown', () => {
  it('renders bold, lists and paragraphs', () => {
    const root = parse(renderMarkdown('Hello **world**\n\n- one\n- two'));

    expect(root.querySelector('strong')).toHaveTextContent('world');
    expect(root.querySelectorAll('li')).toHaveLength(2);
  });

  it.each([
    ['# Title', 'H4'],
    ['## Title', 'H4'],
    ['### Title', 'H4'],
    ['#### Title', 'H4'],
    ['###### Title', 'H6'],
  ])('renders "%s" as %s so the page outline is not disturbed', (markdown, tag) => {
    const root = parse(renderMarkdown(markdown));

    expect(root.querySelector('h1, h2, h3')).toBeNull();
    expect(root.querySelector('h4, h5, h6')?.tagName).toBe(tag);
  });

  it('shows raw HTML as text instead of executing it', () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');

    const root = parse(html);
    expect(root.querySelector('script, img')).toBeNull();
    expect(root.textContent).toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img');
  });

  it('removes javascript: links but keeps their text', () => {
    const root = parse(renderMarkdown('[click](javascript:alert(1))'));

    expect(root.querySelector('a')).toBeNull();
    expect(root.textContent).toContain('click');
  });

  it('only keeps https and mailto links, opening them safely', () => {
    const root = parse(
      renderMarkdown('[a](https://example.com) [b](mailto:a@example.com) [c](http://example.com)'),
    );

    const links = [...root.querySelectorAll('a')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://example.com/',
      'mailto:a@example.com',
    ]);
    for (const link of links) {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    }
  });

  it('never emits an image element, so rendering cannot make a network request', () => {
    const html = renderMarkdown('![a diagram](https://example.com/x.png)');

    expect(html).not.toContain('<img');
    expect(parse(html).textContent).toContain('a diagram');
  });

  it('escapes quotes in link titles', () => {
    const html = renderMarkdown('[a](https://example.com "x\\" onmouseover=\\"alert(1)")');

    expect(parse(html).querySelector('a')?.hasAttribute('onmouseover')).toBe(false);
  });

  it('keeps single newlines as line breaks', () => {
    expect(parse(renderMarkdown('one\ntwo')).querySelector('br')).not.toBeNull();
  });
});

describe('highlightMatches', () => {
  it('wraps case-insensitive matches in <mark>', () => {
    const marks = parse(
      highlightMatches('<p>Career growth and CAREER paths</p>', 'career'),
    ).querySelectorAll('mark');

    expect([...marks].map((mark) => mark.textContent)).toEqual(['Career', 'CAREER']);
  });

  it('only matches text, never tag names or attributes', () => {
    const html = '<a href="https://example.com/strong">link</a><strong>x</strong>';

    expect(highlightMatches(html, 'strong')).toBe(html);
    expect(highlightMatches(html, 'href')).toBe(html);
  });

  it('treats the query literally rather than as a pattern', () => {
    const html = highlightMatches('<p>a.b and a+b and aab</p>', 'a.b');

    expect([...parse(html).querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
      'a.b',
    ]);
  });

  it('returns the html unchanged for a blank query', () => {
    expect(highlightMatches('<p>text</p>', '   ')).toBe('<p>text</p>');
  });
});
