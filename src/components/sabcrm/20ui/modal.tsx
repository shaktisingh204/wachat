'use client';

/**
 * 20ui — Modal.
 *
 * An accessible, portalled dialog. Renders a dimming overlay + a centred panel
 * (`role="dialog"`, `aria-modal`, `aria-labelledby` / `aria-describedby`).
 * Behaviours (the full dialog contract):
 *   - portals to <body> with the `sabcrm-twenty` class so the `--st-*` tokens
 *     resolve even when the trigger lives outside the CRM subtree;
 *   - focuses the first focusable element on open, and RESTORES focus to the
 *     previously-focused element on close;
 *   - traps focus inside the panel (Tab / Shift+Tab cycle past the edges);
 *   - Escape closes; clicking the overlay (but not the panel) closes;
 *   - locks body scroll while open.
 * Emil motion: centred scale-in (transform-origin centre) + a backdrop fade;
 * reduced motion collapses to fade only (handled in modal.css).
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { IconButton } from './button';
import './modal.css';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  /** Whether the dialog is mounted + visible. */
  open: boolean;
  /** Called when the user requests dismissal (Escape, overlay click, close button). */
  onClose: () => void;
  /** Accessible title — rendered in the header and wired to `aria-labelledby`. */
  title: React.ReactNode;
  /** Optional supporting copy under the title, wired to `aria-describedby`. */
  description?: React.ReactNode;
  /** Dialog body. */
  children?: React.ReactNode;
  /** Sticky footer region (typically the action buttons). */
  footer?: React.ReactNode;
  size?: ModalSize;
  /** Hide the header close button (Escape + overlay click still dismiss). */
  hideClose?: boolean;
  /** Extra class on the dialog panel. */
  className?: string;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
  className,
}: ModalProps): React.JSX.Element | null {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  // Portal target only exists on the client.
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Remember the trigger so we can restore focus on close.
  React.useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  // Move focus into the dialog on open; restore it to the trigger on close.
  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = getFocusable(panel)[0] ?? panel;
    // Wait a frame so the entrance is not interrupted and the node is laid out.
    const raf = requestAnimationFrame(() => first?.focus());
    return () => {
      cancelAnimationFrame(raf);
      const toRestore = restoreRef.current;
      if (toRestore && typeof toRestore.focus === 'function') {
        toRestore.focus();
      }
    };
  }, [open]);

  // Lock body scroll while open (compensating for the scrollbar to avoid a shift).
  React.useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  // Escape to close + focus trap (Tab / Shift+Tab cycle within the panel).
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        // Nothing focusable inside — keep focus on the panel itself.
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || active === panelRef.current) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!mounted || !open) return null;

  const overlay = (
    <div className="20ui sabcrm-twenty u-modal-overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={['u-modal', `u-modal--${size}`, className].filter(Boolean).join(' ')}
        // Clicks that start inside the panel must not bubble to the overlay
        // dismiss handler (so dragging a selection out does not close it).
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="u-modal__header">
          <div className="u-modal__heading">
            <h2 id={titleId} className="u-modal__title">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="u-modal__desc">
                {description}
              </p>
            ) : null}
          </div>
          {!hideClose ? (
            <IconButton
              label="Close"
              icon={X}
              size="sm"
              className="u-modal__close"
              onClick={onClose}
            />
          ) : null}
        </header>

        {children != null ? <div className="u-modal__body">{children}</div> : null}

        {footer ? <footer className="u-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

export default Modal;
