'use client';

/**
 * TwentyAppRail — the SabCRM module-switcher rail.
 *
 * A brand-new, Twenty-faithful vertical icon strip that lives at the far
 * left of the SabCRM frame, *before* the `.st-sidebar`. It mirrors the role
 * of the dashboard's `ZoruAppRail` (jump between SabNode apps) but is its
 * own component styled entirely with the `.st-rail*` classes scoped under
 * `.sabcrm-twenty` — no ZoruUI, no Tailwind. The apps come from the central
 * {@link ZORU_APPS} registry so this rail always lists exactly what the rest
 * of the workspace exposes.
 *
 * Each item is a `next/link`, carries an `aria-label`, and shows a
 * CSS-only hover/focus tooltip (`.st-rail__tip`). The currently-active app
 * (SabCRM, while you're under `/sabcrm/*`) is highlighted via each
 * descriptor's own `isActive(pathname)` predicate.
 */

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ZORU_APPS } from '@/components/zoruui/shell/zoru-apps';

const SABNODE_HOME = '/dashboard';

export function TwentyAppRail(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="st-rail" aria-label="SabNode apps">
      {/* Brand mark — back to the SabNode dashboard home. */}
      <Link href={SABNODE_HOME} className="st-rail__brand" aria-label="SabNode home">
        <span className="st-rail__brand-mark" aria-hidden="true">
          S
        </span>
        <span className="st-rail__tip" role="tooltip">
          SabNode home
        </span>
      </Link>

      <div className="st-rail__scroll">
        {ZORU_APPS.map((app) => {
          const active = app.isActive(pathname);
          const Icon = app.Icon;
          return (
            <Link
              key={app.id}
              href={app.href}
              className={`st-rail__item${active ? ' active' : ''}`}
              aria-label={app.name}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="st-rail__icon" aria-hidden="true" />
              <span className="st-rail__tip" role="tooltip">
                {app.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default TwentyAppRail;
