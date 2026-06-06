'use client';

import * as React from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

export function BudgetProgressBar({ utilisation }: { utilisation: number }) {
  const container = React.useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        '.bar',
        { width: '0%' },
        { width: `${utilisation}%`, duration: 1.5, ease: 'power3.out' }
      );
    },
    { scope: container, dependencies: [utilisation] }
  );

  return (
    <div ref={container} className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[var(--st-bg-muted)]">
      <div
        className={`bar h-full ${
          utilisation >= 100
            ? 'bg-[var(--st-danger)]'
            : utilisation >= 80
            ? 'bg-[var(--st-warn)]'
            : 'bg-[var(--st-text)]'
        }`}
        style={{ width: `${utilisation}%` }}
      />
    </div>
  );
}
