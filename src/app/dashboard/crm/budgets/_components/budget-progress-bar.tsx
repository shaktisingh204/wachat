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
    <div ref={container} className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zoru-surface-2">
      <div
        className={`bar h-full ${
          utilisation >= 100
            ? 'bg-zoru-danger-ink'
            : utilisation >= 80
            ? 'bg-zoru-warning-ink'
            : 'bg-zoru-primary'
        }`}
        style={{ width: `${utilisation}%` }}
      />
    </div>
  );
}
