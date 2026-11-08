const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const HIDDEN_SELECTOR = '[inert], [hidden], [aria-hidden="true"]';

/** The next control in page order that is not inside `card`, else the previous one. */
export function findFocusTargetOutside(card: HTMLElement, from: HTMLElement = card) {
  const scope = card.closest('[role="dialog"]') ?? document;
  const controls = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (control) => !card.contains(control) && !control.closest(HIDDEN_SELECTOR),
  );
  const next = controls.find(
    (control) => from.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  return next ?? controls[controls.length - 1];
}

/** Moves focus out of a card that is about to leave the page, so it does not fall to the body. */
export function moveFocusOutside(card: HTMLElement, from: HTMLElement = card) {
  findFocusTargetOutside(card, from)?.focus();
}

/**
 * Picks where focus should go if `card` has focus now and then leaves the page. Call the result
 * once the change is done: it moves focus there only when focus was lost.
 */
export function guardFocusLoss(card: HTMLElement | null): () => void {
  if (!card?.contains(document.activeElement)) return () => undefined;
  const target = findFocusTargetOutside(card);
  return () => {
    const active = document.activeElement;
    if ((!active || active === document.body) && target?.isConnected) target.focus();
  };
}
