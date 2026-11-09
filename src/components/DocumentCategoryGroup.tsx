import { useState } from 'react';
import { DOCUMENT_CATEGORY_LABELS } from '../data/documentLinksStore';
import type { DocumentCategory, DocumentLink, DocumentLinkInput } from '../types/document';
import '../styles/documents.css';
import { DocumentLinkRow } from './DocumentLinkRow';
import { ChevronRightIcon } from './icons';

interface DocumentCategoryGroupProps {
  category: DocumentCategory;
  links: DocumentLink[];
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, values: DocumentLinkInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

/** One collapsible group of links. Open by default; collapsing only toggles local state. */
export function DocumentCategoryGroup({
  category,
  links,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
}: DocumentCategoryGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const slug = category.replace(/_/g, '-');
  const headingId = `category-${slug}-heading`;
  const listId = `category-${slug}-list`;
  const label = DOCUMENT_CATEGORY_LABELS[category];

  return (
    <section className="doc-group" aria-labelledby={headingId}>
      <h4 id={headingId} className="doc-group__heading">
        <button
          type="button"
          className="doc-group__toggle"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((open) => !open)}
        >
          <span
            className={`doc-group__chevron${expanded ? ' doc-group__chevron--open' : ''}`}
            aria-hidden="true"
          >
            <ChevronRightIcon size={20} />
          </span>
          <span className="doc-group__label">{label}</span>
          <span className="doc-group__count">
            {links.length} <span className="sr-only">{links.length === 1 ? 'link' : 'links'}</span>
          </span>
        </button>
      </h4>
      <div
        id={listId}
        className={`doc-group__body${expanded ? '' : ' doc-group__body--collapsed'}`}
      >
        <div className="doc-group__inner">
          <ul className="doc-list" aria-label={label}>
            {links.map((link) => (
              <DocumentLinkRow
                key={link.id}
                link={link}
                isEditing={editingId === link.id}
                onStartEdit={onStartEdit}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
