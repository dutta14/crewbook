import { PencilIcon, TrashIcon, GripIcon } from './icons';
import { CUSTOM_FIELD_TYPE_LABELS } from '../data/customFieldRules';
import type { CustomFieldDefinition } from '../types/customField';
import type { UseDragReorder } from '../hooks/useDragReorder';
import type { ReactNode } from 'react';
import '../styles/custom-fields.css';

interface CustomFieldRowProps {
  field: CustomFieldDefinition;
  index: number;
  count: number;
  drag: UseDragReorder;
  isEditing: boolean;
  /** The inline edit form, shown in place of the row's summary. */
  editor: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}

export function CustomFieldRow({
  field,
  index,
  count,
  drag,
  isEditing,
  editor,
  onEdit,
  onDelete,
  onMove,
}: CustomFieldRowProps) {
  const dragging = drag.drag?.from === index;
  const dropTarget = drag.drag !== null && drag.drag.to === index && !dragging;

  return (
    <li
      ref={(element) => drag.registerRow(index, element)}
      className="custom-field-row"
      data-dragging={dragging || undefined}
      data-drop-target={dropTarget || undefined}
    >
      {isEditing ? (
        <div className="custom-field-row__editor">{editor}</div>
      ) : (
        <div className="custom-field-row__summary">
          <button
            type="button"
            className="icon-btn custom-field-row__handle"
            aria-label={`Reorder ${field.name}`}
            aria-roledescription="draggable"
            {...drag.getHandleProps(index)}
          >
            <GripIcon />
          </button>
          <span className="custom-field-row__name">{field.name}</span>
          <span className="custom-field-row__type">{CUSTOM_FIELD_TYPE_LABELS[field.type]}</span>
          <span className="custom-field-row__arrows">
            <button
              type="button"
              className="icon-btn"
              aria-label={`Move ${field.name} up`}
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
            >
              <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Move ${field.name} down`}
              disabled={index === count - 1}
              onClick={() => onMove(index, index + 1)}
            >
              <span aria-hidden="true">↓</span>
            </button>
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${field.name} field`}
            onClick={onEdit}
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Delete ${field.name} field`}
            onClick={onDelete}
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </li>
  );
}
