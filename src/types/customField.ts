export type CustomFieldType = 'text' | 'date' | 'select' | 'url';

export interface CustomFieldDefinition {
  /** crypto.randomUUID(); also the key of the field's value in `TeamMember.customFields`. */
  id: string;
  name: string;
  type: CustomFieldType;
  /** Only for `select`. */
  options?: string[];
  /** Display order, 0-indexed and contiguous. */
  order: number;
}

/** What the manager supplies; the id and order are assigned by the data layer. */
export interface CustomFieldInput {
  name: string;
  type: CustomFieldType;
  options?: string[];
}

export interface CustomFieldValue {
  fieldId: string;
  /** Every type is stored as a string; a date is YYYY-MM-DD. */
  value: string;
}
