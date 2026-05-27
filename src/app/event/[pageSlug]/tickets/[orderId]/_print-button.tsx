'use client';

import * as React from 'react';

export function PrintButton(): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-black px-3 py-1 text-xs"
    >
      Print
    </button>
  );
}
