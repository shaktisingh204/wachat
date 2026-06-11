import * as React from 'react';

/**
 * Label/value row for SabPay detail pages — the shared extraction of the
 * `Row` helper from `payments/[id]/page.tsx`. Stack them inside a
 * `<Card><CardBody>` for a Stripe-style detail panel.
 */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--st-border)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--st-text-muted)' }}>{label}</span>
      <span style={{ overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

/** Monospace span for ids (pay_…, ord_…, txn references) inside a DetailRow. */
export function MonoSpan({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 13 }}>{children}</span>
  );
}
