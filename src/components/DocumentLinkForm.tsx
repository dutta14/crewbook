import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_TITLE_MAX_LENGTH,
  INVALID_URL_MESSAGE,
  isDocumentCategory,
} from '../data/documentLinksStore';
import { ValidationError } from '../data/errors';
import type { DocumentLinkInput } from '../types/document';
import { URL_MAX_LENGTH, normalizeExternalUrl } from '../utils/externalUrl';
import '../styles/button.css';
import '../styles/documents.css';
import '../styles/form.css';
import { FormField } from './FormField';

interface DocumentLinkFormProps {
  initial?: DocumentLinkInput;
  /** Saves the link. Rejects when it could not be saved; a ValidationError is shown in the form. */
  onSubmit: (values: DocumentLinkInput) => Promise<void>;
  onCancel: () => void;
}

const EMPTY: DocumentLinkInput = { title: '', url: '', category: 'other' };

const TITLE_REQUIRED = 'Enter a title';
const URL_REQUIRED = 'Enter a link';

const getUrlError = (url: string) => {
  if (url.trim() === '') return URL_REQUIRED;
  return normalizeExternalUrl(url) === null ? INVALID_URL_MESSAGE : '';
};

/** Adds a link or edits one in place. The caller closes it once `onSubmit` resolves. */
export function DocumentLinkForm({ initial, onSubmit, onCancel }: DocumentLinkFormProps) {
  const prefix = useId();
  const [values, setValues] = useState(initial ?? EMPTY);
  const [titleError, setTitleError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    titleRef.current?.focus();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const ids = { title: `${prefix}-title`, url: `${prefix}-url`, category: `${prefix}-category` };
  const isIncomplete = values.title.trim() === '' || values.url.trim() === '';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isIncomplete) return;
    const nextUrlError = getUrlError(values.url);
    if (nextUrlError) {
      setUrlError(nextUrlError);
      urlRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      // The data layer re-validates; its messages never include what was typed. Anything else has
      // already been reported with a toast.
      if (error instanceof ValidationError && isMounted.current) {
        if (normalizeExternalUrl(values.url) === null) {
          setUrlError(error.message);
          urlRef.current?.focus();
        } else {
          setTitleError(error.message);
          titleRef.current?.focus();
        }
      }
    } finally {
      if (isMounted.current) setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- only listens for Escape
    <form
      className="doc-form"
      noValidate
      autoComplete="off"
      aria-label={initial ? 'Edit document link' : 'Add document link'}
      aria-busy={isSubmitting}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <FormField id={ids.title} label="Title" required error={titleError}>
        <input
          ref={titleRef}
          id={ids.title}
          type="text"
          className="form-input"
          autoComplete="off"
          aria-required="true"
          maxLength={DOCUMENT_TITLE_MAX_LENGTH}
          value={values.title}
          onChange={(event) => {
            const { value } = event.target;
            setValues((current) => ({ ...current, title: value }));
            setTitleError('');
          }}
          onBlur={() => setTitleError(values.title.trim() === '' ? TITLE_REQUIRED : '')}
          {...(titleError
            ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.title}-error` }
            : {})}
        />
      </FormField>
      <FormField id={ids.url} label="Link" required error={urlError}>
        <input
          ref={urlRef}
          id={ids.url}
          type="url"
          className="form-input"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="https://"
          aria-required="true"
          maxLength={URL_MAX_LENGTH}
          value={values.url}
          onChange={(event) => {
            const { value } = event.target;
            setValues((current) => ({ ...current, url: value }));
            setUrlError('');
          }}
          onBlur={() => setUrlError(values.url === '' ? '' : getUrlError(values.url))}
          {...(urlError
            ? { 'aria-invalid': true as const, 'aria-describedby': `${ids.url}-error` }
            : {})}
        />
      </FormField>
      <FormField id={ids.category} label="Category">
        <select
          id={ids.category}
          className="form-input"
          value={values.category}
          onChange={(event) => {
            const { value } = event.target;
            if (isDocumentCategory(value))
              setValues((current) => ({ ...current, category: value }));
          }}
        >
          {DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DOCUMENT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </FormField>
      <div className="doc-form__footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isIncomplete || isSubmitting}>
          Save
        </button>
      </div>
    </form>
  );
}
