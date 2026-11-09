import { useState } from 'react';
import { CUSTOM_FIELD_LIMITS } from '../data/customFieldRules';
import { useDragReorder } from '../hooks/useDragReorder';
import type { CustomFieldDefinition, CustomFieldInput } from '../types/customField';
import { CustomFieldDeleteDialog } from './CustomFieldDeleteDialog';
import { CustomFieldForm } from './CustomFieldForm';
import { CustomFieldRow } from './CustomFieldRow';
import { PlusIcon } from './icons';
import '../styles/custom-fields.css';

interface CustomFieldSettingsProps {
  definitions: readonly CustomFieldDefinition[];
  getAffectedCount: (fieldId: string) => number;
  onAddField: (input: CustomFieldInput) => Promise<void>;
  onEditField: (id: string, input: CustomFieldInput) => Promise<void>;
  onRemoveField: (id: string) => Promise<void>;
  onReorder: (fromIndex: number, toIndex: number) => Promise<void>;
}

const LIMIT_REACHED = `You can add up to ${CUSTOM_FIELD_LIMITS.count} custom fields`;

export function CustomFieldSettings({
  definitions,
  getAffectedCount,
  onAddField,
  onEditField,
  onRemoveField,
  onReorder,
}: CustomFieldSettingsProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CustomFieldDefinition | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const atLimit = definitions.length >= CUSTOM_FIELD_LIMITS.count;

  const move = async (fromIndex: number, toIndex: number) => {
    const field = definitions[fromIndex];
    try {
      await onReorder(fromIndex, toIndex);
      setAnnouncement(`${field.name} moved to position ${toIndex + 1}`);
    } catch {
      // The hook has already shown the error; the list still shows the saved order.
    }
  };
  const drag = useDragReorder(definitions.length, (from, to) => void move(from, to));

  const confirmDelete = async () => {
    if (!deleting) return;
    const { id } = deleting;
    setDeleting(null);
    try {
      await onRemoveField(id);
    } catch {
      // The hook has already shown the error.
    }
  };

  return (
    <section className="settings-section" aria-labelledby="settings-custom-fields-heading">
      <h2 id="settings-custom-fields-heading" className="settings-section__title">
        Custom Fields
      </h2>
      <p className="custom-fields__intro">
        Add fields for details that matter on your team. They show on every profile.
      </p>
      {definitions.length === 0 && !adding ? (
        <p className="custom-fields__empty">No custom fields yet.</p>
      ) : null}
      {definitions.length > 0 ? (
        <ol className="custom-field-list" aria-label="Custom fields">
          {definitions.map((field, index) => (
            <CustomFieldRow
              key={field.id}
              field={field}
              index={index}
              count={definitions.length}
              drag={drag}
              isEditing={editingId === field.id}
              editor={
                <CustomFieldForm
                  field={field}
                  existing={definitions}
                  onSave={async (input) => {
                    await onEditField(field.id, input);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              }
              onEdit={() => {
                setAdding(false);
                setEditingId(field.id);
              }}
              onDelete={() => setDeleting(field)}
              onMove={(from, to) => void move(from, to)}
            />
          ))}
        </ol>
      ) : null}
      {adding ? (
        <CustomFieldForm
          existing={definitions}
          onSave={async (input) => {
            await onAddField(input);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="custom-fields__footer">
          <button
            type="button"
            className="btn btn-ghost"
            aria-disabled={atLimit || undefined}
            title={atLimit ? LIMIT_REACHED : undefined}
            aria-describedby={atLimit ? 'custom-fields-limit' : undefined}
            onClick={() => {
              if (atLimit) return;
              setEditingId(null);
              setAdding(true);
            }}
          >
            <PlusIcon size={16} />
            Add field
          </button>
          <span className="custom-fields__counter">
            {definitions.length} / {CUSTOM_FIELD_LIMITS.count} fields used
          </span>
          {atLimit ? (
            <span id="custom-fields-limit" className="sr-only">
              {LIMIT_REACHED}
            </span>
          ) : null}
        </div>
      )}
      {definitions.length === 0 ? (
        <p className="custom-fields__advisory">
          Custom field values are stored in your encrypted vault. Avoid collecting data you
          wouldn&apos;t want in a breach disclosure.
        </p>
      ) : null}
      <div className="sr-only" role="status" aria-live="assertive">
        {announcement}
      </div>
      <CustomFieldDeleteDialog
        field={deleting}
        affectedCount={deleting ? getAffectedCount(deleting.id) : 0}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
