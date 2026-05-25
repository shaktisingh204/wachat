import { Button, Card } from '@/components/zoruui';
import {
  AlertTriangle,
  CircleCheck,
  FileText,
  Plus,
  Receipt,
  ShoppingCart,
  Truck,
  } from 'lucide-react';

/**
 * <ItemRelatedRail> — right-rail snapshot for the item detail page.
 *
 * Pure server component. Renders:
 *   - Stock summary (total on-hand, low/out warning, last movement date)
 *   - Related entities (invoices using this SKU, POs, GRN entries, stock
 *     adjustments, BOMs containing this) — placeholders linking to the
 *     respective list pages with `?productId=` filters.
 *   - Quick "Add to PO" / "Add to Invoice" CTA buttons that thread a
 *     `defaultItemId=` into the target /new form.
 */

import Link from 'next/link';
import { fmtDate } from '@/lib/utils';

interface ItemRelatedRailProps {
  productId: string;
  totalStock: number;
  lowStock: boolean;
  outOfStock: boolean;
  lastUpdated?: string;
}



export function ItemRelatedRail({
  productId,
  totalStock,
  lowStock,
  outOfStock,
  lastUpdated,
}: ItemRelatedRailProps) {
  const tone = outOfStock ? 'danger' : lowStock ? 'warning' : 'success';
  const message = outOfStock
    ? 'Out of stock — purchase to replenish'
    : lowStock
      ? 'Stock at or below reorder point'
      : 'Stock healthy';

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Stock summary
        </h3>
        <div className="space-y-2 text-[12.5px]">
          <div className="flex items-center justify-between">
            <span className="text-zoru-ink-muted">Total on hand</span>
            <span className="font-mono tabular-nums text-zoru-ink">
              {totalStock}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zoru-ink-muted">Last movement</span>
            <span className="text-zoru-ink-muted">{fmtDate(lastUpdated)}</span>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-[11.5px] ${
              tone === 'danger'
                ? 'border-zoru-danger/40 bg-zoru-danger/5 text-zoru-danger-ink'
                : tone === 'warning'
                  ? 'border-zoru-warning/40 bg-zoru-warning/5 text-zoru-warning-ink'
                  : 'border-zoru-success/40 bg-zoru-success/5 text-zoru-success-ink'
            }`}
          >
            {tone === 'success' ? (
              <CircleCheck className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {message}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Quick actions
        </h3>
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link
              href={`/dashboard/crm/sales/invoices/new?defaultItemId=${productId}`}
            >
              <Plus className="h-3.5 w-3.5" /> Add to Invoice
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link
              href={`/dashboard/crm/inventory/purchase-orders/new?defaultItemId=${productId}`}
            >
              <Plus className="h-3.5 w-3.5" /> Add to PO
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link
              href={`/dashboard/crm/inventory/adjustments/new?productId=${productId}`}
            >
              <Plus className="h-3.5 w-3.5" /> Adjust stock
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
          Related
        </h3>
        <ul className="space-y-1.5 text-[12.5px]">
          <RelatedLink
            href={`/dashboard/crm/sales/invoices?productId=${productId}`}
            icon={<Receipt className="h-3.5 w-3.5" />}
            label="Invoices using this SKU"
          />
          <RelatedLink
            href={`/dashboard/crm/inventory/purchase-orders?productId=${productId}`}
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            label="Purchase orders"
          />
          <RelatedLink
            href={`/dashboard/crm/inventory/grn?productId=${productId}`}
            icon={<Truck className="h-3.5 w-3.5" />}
            label="GRN entries"
          />
          <RelatedLink
            href={`/dashboard/crm/inventory/adjustments?productId=${productId}`}
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Stock adjustments"
          />
          <RelatedLink
            href={`/dashboard/crm/inventory/bom?productId=${productId}`}
            icon={<FileText className="h-3.5 w-3.5" />}
            label="BOMs containing this"
          />
        </ul>
      </Card>
    </div>
  );
}

function RelatedLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-zoru-ink hover:bg-zoru-surface-2"
      >
        <span className="inline-flex items-center gap-1.5 text-zoru-ink">
          <span className="text-zoru-ink-muted">{icon}</span>
          {label}
        </span>
      </Link>
    </li>
  );
}
