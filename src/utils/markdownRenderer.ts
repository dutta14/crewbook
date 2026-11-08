import DOMPurify from 'dompurify';
import { Marked } from 'marked';

const SAFE_LINK_PROTOCOLS = new Set(['https:', 'mailto:']);
const MIN_HEADING_LEVEL = 4;

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'strong',
  'em',
  'del',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h4',
  'h5',
  'h6',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'input',
];

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeLink(href: string): string | null {
  try {
    const url = new URL(href.trim());
    return SAFE_LINK_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Raw HTML in a note is shown as text, and images become their alt text so rendering a note can
// never start a network request.
const parser = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    image: ({ text }) => escapeHtml(text),
    heading({ tokens, depth }) {
      const level = Math.max(depth, MIN_HEADING_LEVEL);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const safe = safeLink(href);
      if (!safe) return inner;
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safe)}"${titleAttribute}>${inner}</a>`;
    },
  },
});

// DOMPurify drops target and rel, so every surviving link is hardened after sanitizing.
const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Markdown to sanitized HTML. Headings are capped at h4 so a note never disturbs the page outline,
 * links are limited to https and mailto, and images are never loaded.
 */
export function renderMarkdown(raw: string): string {
  const html = parser.parse(raw) as string;
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'title', 'type', 'checked', 'disabled'],
    ALLOWED_URI_REGEXP: /^(?:https:|mailto:)/i,
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Wraps case-insensitive matches of `query` in text nodes with <mark>. Works on already-sanitized
 * HTML and only ever adds <mark> elements. Plain substring search, no regular expressions.
 */
export function highlightMatches(html: string, query: string): string {
  const needle = query.trim().toLowerCase();
  if (!needle) return html;

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) textNodes.push(node as Text);

  for (const node of textNodes) {
    const text = node.data;
    const lower = text.toLowerCase();
    // Some characters change length when lowercased; offsets would no longer line up.
    if (lower.length !== text.length || !lower.includes(needle)) continue;

    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, cursor)) {
      if (at > cursor) fragment.append(text.slice(cursor, at));
      const mark = doc.createElement('mark');
      mark.textContent = text.slice(at, at + needle.length);
      fragment.append(mark);
      cursor = at + needle.length;
    }
    if (cursor < text.length) fragment.append(text.slice(cursor));
    node.replaceWith(fragment);
  }
  return doc.body.innerHTML;
}
