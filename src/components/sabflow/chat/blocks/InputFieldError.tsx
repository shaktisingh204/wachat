'use client';

import { LuCircleAlert } from 'react-icons/lu';

type Props = {
  error: string;
};

/**
 * Inline error message shown under an input field when validation
 * fails.  Uses the shared `sabflow-error-slide-in` keyframe defined
 * below (auto-injected once per page) for a subtle slide/fade-in.
 */
export function InputFieldError({ error }: Props) {
  if (!error) return null;

  return (
    <>
      <InputFieldErrorStyles />
      <div
        role="alert"
        aria-live="polite"
        className="flex items-start gap-1.5 text-[11.5px] text-red-500 leading-snug"
        style={{
          animation: 'sabflow-error-slide-in 160ms ease-out',
        }}
      >
        <LuCircleAlert
          className="mt-[1px] h-3 w-3 shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="break-words">{error}</span>
      </div>
    </>
  );
}

/**
 * Stylesheet injection — keeps the keyframe definition colocated with
 * the component without needing a global CSS edit.  Rendered once per
 * page and coalesced by the browser after first mount.
 */
function InputFieldErrorStyles() {
  return (
    <style>{`
      @keyframes sabflow-error-slide-in {
        0%   { opacity: 0; transform: translateY(-2px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}
