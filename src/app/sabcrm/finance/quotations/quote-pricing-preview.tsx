'use client';

/**
 * SabCRM Finance — CPQ live-pricing preview (quotation form).
 *
 * Renders inside the quotation DocForm (via `config.extraFields`). As the rep
 * edits line items it (debounced) calls the gated `computeQuotePricingTw`
 * action — the SAME server engine the submit path re-runs — to show:
 *
 *   - the live priced grand total + blended effective discount %, against the
 *     project's active price book (volume tiers + manual discount + tax);
 *   - a compact per-line waterfall trace so the rep can see exactly why each
 *     line landed where it did;
 *   - an approval banner when the discount breaches the project threshold.
 *
 * DEGRADES GRACEFULLY: the price book / action is best-effort. Any failure (no
 * price book, no permission, network) hides the panel silently — the form keeps
 * working exactly as it does today (the hand-built doc-math totals in the line
 * editor remain the source of truth for what gets saved). This panel is
 * informational + advisory; it never blocks a save.
 *
 * It NEVER mutates `values` (read-only `patch` unused) — purely advisory.
 */

import * as React from 'react';

import { Alert, Badge } from '@/components/sabcrm/20ui';
import { computeQuotePricingTw } from '@/app/actions/sabcrm-pricing.actions';

import { formatDocMoney } from '../_components/doc-surface';
import type { DocFormExtraFieldsApi } from '../_components/doc-surface';
import {
  docLinesToQuoteLines,
  hasPriceableLines,
  type QuotePricingResult,
} from './quote-pricing-map';

export function QuotePricingPreview({
  values,
}: DocFormExtraFieldsApi): React.JSX.Element | null {
  const [result, setResult] = React.useState<QuotePricingResult | null>(null);
  const [pricing, setPricing] = React.useState(false);
  // We never surface pricing ERRORS to the rep — a downed price book must not
  // look like a form problem. We just hide the panel.
  const [available, setAvailable] = React.useState(true);

  const lines = values.lines;
  const key = React.useMemo(
    () => JSON.stringify(docLinesToQuoteLines(lines)),
    [lines],
  );
  const priceable = hasPriceableLines(lines);

  React.useEffect(() => {
    if (!priceable) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setPricing(true);
    // Light debounce so we don't price on every keystroke.
    const handle = setTimeout(() => {
      void computeQuotePricingTw({ lines: docLinesToQuoteLines(lines) })
        .then((res) => {
          if (cancelled) return;
          if (res.ok) {
            setResult(res.data);
            setAvailable(true);
          } else {
            // No price book / no permission → degrade: hide the panel.
            setResult(null);
            setAvailable(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setResult(null);
            setAvailable(false);
          }
        })
        .finally(() => {
          if (!cancelled) setPricing(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // `key` captures the meaningful line content; `lines` is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, priceable]);

  // Nothing to show: no priceable lines, or the engine isn't available here.
  if (!priceable) return null;
  if (!available && !result) return null;
  if (!result) {
    // First price in flight (avoids a flash of empty panel).
    return pricing ? (
      <div className="fdoc-form-grid__full">
        <div
          className="px-3 py-2 text-sm"
          style={{
            border: '1px solid var(--st-border)',
            borderRadius: 'var(--st-radius)',
            color: 'var(--st-text-tertiary)',
          }}
        >
          Pricing against your price book…
        </div>
      </div>
    ) : null;
  }

  const { currency } = result;
  const money = (n: number): string => formatDocMoney(n, currency);
  const tracedLines = result.lines.filter((l) => l.steps.length > 1);

  return (
    <div className="fdoc-form-grid__full">
      <div
        className="p-3"
        style={{
          border: '1px solid var(--st-border)',
          borderRadius: 'var(--st-radius)',
          background: 'var(--st-bg-secondary)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--st-text)' }}
          >
            CPQ priced total
          </span>
          <span className="flex items-center gap-2">
            {result.effectiveDiscountPct > 0 ? (
              <Badge tone="info">{result.effectiveDiscountPct}% off</Badge>
            ) : null}
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: 'var(--st-text)' }}
            >
              {money(result.total)}
            </span>
          </span>
        </div>

        <dl
          className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4"
          style={{ color: 'var(--st-text-tertiary)' }}
        >
          <div>
            <dt>Gross</dt>
            <dd className="tabular-nums" style={{ color: 'var(--st-text)' }}>
              {money(result.grossTotal)}
            </dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd className="tabular-nums" style={{ color: 'var(--st-text)' }}>
              −{money(result.discountTotal)}
            </dd>
          </div>
          <div>
            <dt>Sub-total</dt>
            <dd className="tabular-nums" style={{ color: 'var(--st-text)' }}>
              {money(result.subTotal)}
            </dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd className="tabular-nums" style={{ color: 'var(--st-text)' }}>
              {money(result.taxTotal)}
            </dd>
          </div>
        </dl>

        {tracedLines.length > 0 ? (
          <div
            className="mt-3 pt-2"
            style={{ borderTop: '1px solid var(--st-border)' }}
          >
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--st-text-tertiary)' }}
            >
              Pricing waterfall
            </span>
            <ul className="mt-1 space-y-1">
              {tracedLines.map((line, i) => (
                <li key={i} className="text-xs">
                  <span style={{ color: 'var(--st-text)' }}>
                    {line.description || line.itemId || `Line ${i + 1}`}
                  </span>
                  <span
                    className="ml-1"
                    style={{ color: 'var(--st-text-tertiary)' }}
                  >
                    {line.steps.map((s) => s.label).join(' → ')} ={' '}
                    {money(line.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.approval.needsApproval ? (
          <div className="mt-3">
            <Alert tone="warning" role="status">
              This {result.approval.effectiveDiscountPct}% discount exceeds the{' '}
              {result.approval.thresholdPct}% threshold — saving will request
              discount approval.
            </Alert>
          </div>
        ) : null}
      </div>
    </div>
  );
}
