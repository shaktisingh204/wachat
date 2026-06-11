import * as React from 'react';
import Link from 'next/link';

/**
 * Pill navigation across the four in-app SabPay docs pages. Server component —
 * each page passes its own href as `active` (no usePathname needed for a
 * static folder set).
 */

const DOCS_LINKS = [
  { href: '/sabpay/docs', label: 'Getting started' },
  { href: '/sabpay/docs/api', label: 'API reference' },
  { href: '/sabpay/docs/webhooks', label: 'Webhooks' },
  { href: '/sabpay/docs/checkout', label: 'Checkout surfaces' },
] as const;

export type DocsNavHref = (typeof DOCS_LINKS)[number]['href'];

export function DocsNav({ active }: { active: DocsNavHref }): React.JSX.Element {
  return (
    <nav aria-label="SabPay developer docs" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {DOCS_LINKS.map((link) => {
        const isActive = link.href === active;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              border: `1px solid ${isActive ? 'var(--st-accent)' : 'var(--st-border)'}`,
              color: isActive ? 'var(--st-accent)' : 'var(--st-text-muted)',
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
