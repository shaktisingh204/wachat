/* ─────────────────────────────────────────────────────────────────────────────
   caretPosition.ts

   Computes the pixel coordinates of the caret inside an <input> or <textarea>
   using the classic "mirror div" technique:

   1. Create a hidden <div> that visually mirrors the source element
      (same font, padding, border, width, etc.).
   2. Copy the text up to the caret into the mirror.
   3. Insert a zero-width <span> at the caret position.
   4. Measure the span's bounding box relative to the source element.

   This is the same approach used by libraries such as textarea-caret-position.
   It works reliably across browsers because measuring a laid-out span is far
   more accurate than doing font-metrics math by hand.
   ──────────────────────────────────────────────────────────────────────────── */

type TextLikeElement = HTMLInputElement | HTMLTextAreaElement;

export interface CaretCoordinates {
  /** Top offset (px) from the top-left corner of the element's client box. */
  top: number;
  /** Left offset (px) from the top-left corner of the element's client box. */
  left: number;
  /** Line height (px) used at the caret — useful for positioning a dropdown. */
  height: number;
}

/* Properties we copy from the source element to the mirror. */
const MIRROR_PROPERTIES: ReadonlyArray<keyof CSSStyleDeclaration> = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const;

/**
 * Compute caret coordinates inside a text-like element.
 *
 * The returned {@link CaretCoordinates} are relative to the element itself
 * (i.e. add `element.getBoundingClientRect().left` to get viewport coords).
 */
export function getCaretCoordinates(
  element: TextLikeElement,
): CaretCoordinates {
  // SSR guard — the mirror technique is pure DOM.
  if (typeof document === 'undefined') {
    return { top: 0, left: 0, height: 0 };
  }

  const isInput = element.tagName.toLowerCase() === 'input';

  // Build the mirror once per call; creating + removing it keeps state clean.
  const mirror = document.createElement('div');
  mirror.id = 'sabflow-caret-mirror';

  const style = mirror.style;
  style.whiteSpace = isInput ? 'nowrap' : 'pre-wrap';
  style.wordWrap = isInput ? 'normal' : 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.overflow = 'hidden';
  // Place well outside the viewport so it never causes layout shifts.
  style.top = '0';
  style.left = '-9999px';

  // Copy visual properties from the source element.
  const computed = window.getComputedStyle(element);
  for (const prop of MIRROR_PROPERTIES) {
    // Some read-only entries on CSSStyleDeclaration (e.g. length) are irrelevant;
    // guard by only copying string values.
    const value = computed[prop];
    if (typeof value === 'string') {
      // Writing via setProperty avoids TS's readonly protection on certain keys.
      style.setProperty(
        // camelCase → kebab-case for setProperty.
        (prop as string).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
        value,
      );
    }
  }

  // For inputs, the mirror should behave like a single line that can scroll.
  if (isInput) {
    style.whiteSpace = 'nowrap';
    // The effective visible width matches the input's content box; otherwise
    // the span horizontal position would be clipped.
    style.width = 'auto';
  }

  // Text up to the caret.
  const selectionEnd = element.selectionEnd ?? element.value.length;
  const textBefore = element.value.substring(0, selectionEnd);
  mirror.textContent = textBefore;

  // Append a marker span at the caret position.
  const marker = document.createElement('span');
  // Use a zero-width non-joiner so the span actually lays out but contributes
  // no visible width.  Using an empty string would collapse the span height.
  marker.textContent = '\u200B';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  // Line height fallback when computed is "normal".
  const parsedLineHeight = parseFloat(computed.lineHeight);
  const fallbackHeight = parseFloat(computed.fontSize) * 1.2;
  const height = Number.isFinite(parsedLineHeight)
    ? parsedLineHeight
    : fallbackHeight;

  const coords: CaretCoordinates = {
    top: marker.offsetTop - element.scrollTop,
    left: marker.offsetLeft - element.scrollLeft,
    height,
  };

  document.body.removeChild(mirror);

  return coords;
}
