import { useMemo, useRef, useState } from 'react';
import { DOCUMENT_CATEGORIES } from '../data/documentLinksStore';
import type { DocumentCategory, DocumentLink, DocumentLinkInput } from '../types/document';
import type { DocumentLinkUpdate } from '../data/documentLinksStore';
import '../styles/button.css';
import '../styles/documents.css';
import { DocumentCategoryGroup } from './DocumentCategoryGroup';
import { DocumentLinkForm } from './DocumentLinkForm';
import { EmptyState } from './EmptyState';
import { FileIcon } from './icons';

export interface DocumentLinksProps {
  links: DocumentLink[];
  /** Each callback rejects when the change could not be saved; a ValidationError is shown in the form. */
  onAddLink: (input: DocumentLinkInput) => Promise<void>;
  onEditLink: (id: string, updates: DocumentLinkUpdate) => Promise<void>;
  onRemoveLink: (id: string) => Promise<void>;
}

/** A person's document links, grouped by category. Links only; nothing is uploaded or previewed. */
export function DocumentLinks({ links, onAddLink, onEditLink, onRemoveLink }: DocumentLinksProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo(() => {
    const byCategory = new Map<DocumentCategory, DocumentLink[]>();
    for (const link of links)
      byCategory.set(link.category, [...(byCategory.get(link.category) ?? []), link]);
    return DOCUMENT_CATEGORIES.flatMap((category) => {
      const inCategory = byCategory.get(category);
      return inCategory ? [{ category, links: inCategory }] : [];
    });
  }, [links]);

  const refocusAdd = () => {
    // The form is replaced by the button that opened it, so focus would otherwise be lost.
    requestAnimationFrame(() => addRef.current?.focus());
  };

  const closeAdd = () => {
    setIsAdding(false);
    refocusAdd();
  };

  const handleAdd = async (values: DocumentLinkInput) => {
    await onAddLink(values);
    closeAdd();
  };

  const handleEdit = async (id: string, values: DocumentLinkInput) => {
    await onEditLink(id, values);
    setEditingId(null);
  };

  const handleRemove = async (id: string) => {
    await onRemoveLink(id);
    // The row that held focus is gone.
    refocusAdd();
  };

  return (
    <section className="documents" aria-labelledby="documents-heading">
      <h3 id="documents-heading" className="documents__title">
        Documents
      </h3>
      <div className="documents__card">
        {groups.length === 0 && !isAdding ? (
          <EmptyState
            icon={<FileIcon size={48} />}
            title="No documents linked yet"
            description="Add links to promo packets, self-reviews, career ladders and development plans. Crewbook keeps only the link; the document stays where it is."
            headingLevel={4}
          />
        ) : null}
        {groups.map(({ category, links: inCategory }) => (
          <DocumentCategoryGroup
            key={category}
            category={category}
            links={inCategory}
            editingId={editingId}
            onStartEdit={(id) => {
              setIsAdding(false);
              setEditingId(id);
            }}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={handleEdit}
            onRemove={handleRemove}
          />
        ))}
        {isAdding ? (
          <DocumentLinkForm onSubmit={handleAdd} onCancel={closeAdd} />
        ) : (
          <button
            ref={addRef}
            type="button"
            className="btn btn-ghost documents__add"
            onClick={() => {
              setEditingId(null);
              setIsAdding(true);
            }}
          >
            <span aria-hidden="true">+</span> Add document link
          </button>
        )}
      </div>
    </section>
  );
}
