import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/sabcrm/20ui/compat';
import { Package, Pencil } from 'lucide-react';
import type { WithId } from 'mongodb';

/**
 * <ItemDetailBody> — body cards on the item detail page.
 *
 * Pure server component. Renders:
 *   - Overview (key identifying fields)
 *   - Pricing (with discount breakdown)
 *   - Inventory (stock-per-warehouse table with adjust inline button)
 *   - Variants (if this is a parent SKU)
 *   - Suppliers / Vendors chips
 *   - Accounting refs
 *   - Images gallery
 *   - Dimensions card
 *   - Specifications + custom attributes + tags
 *
 * The dynamic / mutating regions live elsewhere (right rail, header
 * actions). This file is intentionally large but presentation-only.
 */

import Link from 'next/link';
import { fmtINR } from '@/lib/utils';
import { ItemDetailTabs } from './item-detail-tabs';
import Image from 'next/image';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmProduct } from '@/lib/definitions';

interface ItemDetailBodyProps {
  defaultTab?: string;
  product: WithId<CrmProduct> & { status?: string; reorderPoint?: number };
  productId: string;
}



export function ItemDetailBody({ product, productId, defaultTab }: ItemDetailBodyProps) {
  const currency = product.currency || 'INR';
  const variants = (product.variants as unknown[]) ?? [];
  const specs = (product.specifications as { key: string; value: string }[]) ?? [];
  const customAttrs =
    (product.customAttributes as { key: string; value: string }[]) ?? [];
  const tags =
    (Array.isArray(product.tags)
      ? (product.tags as string[]).join(', ')
      : (product.tags as string | undefined)) ?? '';
  const gallery = (product.images ?? []).slice(1);
  const thumbnail = product.images?.[0];
  const vendorIds = (product.vendorIds as unknown[] | undefined) ?? [];
  const reorderPoint =
    (product.reorderPoint as number | undefined) ??
    product.inventory?.[0]?.reorderPoint;

  return (
    <ItemDetailTabs defaultTab={defaultTab}>
      <TabsContent value="overview" className="space-y-4">
      {/* Overview */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Name">{product.name || '—'}</DetailField>
          <DetailField label="Type">
            <span className="capitalize">{product.itemType ?? 'goods'}</span>
          </DetailField>
          <DetailField label="SKU">
            <span className="font-mono">{product.sku || '—'}</span>
          </DetailField>
          <DetailField label="Barcode">
            <span className="font-mono">
              {(product.barcode as string | undefined) ?? '—'}
            </span>
          </DetailField>
          <DetailField label="HSN / SAC">{product.hsnSac || '—'}</DetailField>
          <DetailField label="Manufacturer">
            {(product.manufacturer as string | undefined) ?? '—'}
          </DetailField>
          <DetailField label="MPN">
            {(product.mpn as string | undefined) ?? '—'}
          </DetailField>
          <DetailField label="Country of origin">
            {(product.countryOfOrigin as string | undefined) ?? '—'}
          </DetailField>
          <DetailField label="Category">
            {product.categoryId ? (
              <EntityPickerChip
                entity="category"
                id={String(product.categoryId)}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Brand">
            {product.brandId ? (
              <EntityPickerChip entity="brand" id={String(product.brandId)} />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Unit">
            {product.unitId ? (
              <EntityPickerChip entity="unit" id={String(product.unitId)} />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Status">
            <StatusPill
              label={(product.status as string) ?? 'active'}
              tone={statusToTone((product.status as string) ?? 'active')}
            />
          </DetailField>
          {product.description ? (
            <DetailField label="Short description" colSpan={2}>
              <pre className="whitespace-pre-wrap font-sans text-[13px]">
                {product.description}
              </pre>
            </DetailField>
          ) : null}
          {(product.longDescription as string | undefined) ? (
            <DetailField label="Long description" colSpan={2}>
              <pre className="whitespace-pre-wrap font-sans text-[13px]">
                {product.longDescription as string}
              </pre>
            </DetailField>
          ) : null}
        </div>
      </Card>

      </TabsContent>
      <TabsContent value="pricing" className="space-y-4">
      {/* Pricing */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Pricing
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DetailField label="Selling price">
            {fmtINR(product.sellingPrice, currency)}
          </DetailField>
          <DetailField label="MRP">
            {fmtINR(product.mrp as number | undefined, currency)}
          </DetailField>
          <DetailField label="Discount %">
            {typeof product.discountPct === 'number'
              ? `${product.discountPct}%`
              : '—'}
          </DetailField>
          <DetailField label="Wholesale">
            {fmtINR(product.wholesalePrice as number | undefined, currency)}
          </DetailField>
          <DetailField label="Cost price">
            {fmtINR(product.costPrice, currency)}
          </DetailField>
          <DetailField label="Currency">{currency}</DetailField>
          <DetailField label="Tax rate">
            {typeof product.taxRate === 'number' ? `${product.taxRate}%` : '—'}
          </DetailField>
          <DetailField label="Cess">
            {typeof product.cess === 'number' ? `${product.cess}%` : '—'}
          </DetailField>
          <DetailField label="Tax inclusive?">
            {product.taxInclusive ? 'Yes' : 'No'}
          </DetailField>
        </div>
      </Card>

      </TabsContent>
      <TabsContent value="inventory" className="space-y-4">
      {/* Inventory per warehouse */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Inventory
        </h2>
        {!product.isTrackInventory ? (
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            Inventory tracking is disabled for this item.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--st-bg-muted)]">
                <tr className="border-b border-[var(--st-border)] text-left">
                  <th className="p-2 font-medium text-[var(--st-text)]">Warehouse</th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    On hand
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Committed
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Available
                  </th>
                  <th className="p-2 text-right font-medium text-[var(--st-text)]">
                    Reorder?
                  </th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(product.inventory ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-6 text-center text-[var(--st-text-secondary)]"
                    >
                      No warehouse rows. Use Adjust stock to seed inventory.
                    </td>
                  </tr>
                ) : (
                  (product.inventory ?? []).map((row, idx) => {
                    const stock = row.stock ?? 0;
                    const rp = row.reorderPoint ?? reorderPoint ?? 0;
                    const reorder = stock <= rp;
                    return (
                      <tr
                        key={idx}
                        className="border-b border-[var(--st-border)] last:border-b-0"
                      >
                        <td className="p-2 align-middle">
                          <EntityPickerChip
                            entity="warehouse"
                            id={String(row.warehouseId)}
                          />
                        </td>
                        <td className="p-2 text-right align-middle font-mono tabular-nums text-[var(--st-text)]">
                          {stock}
                        </td>
                        <td className="p-2 text-right align-middle font-mono tabular-nums text-[var(--st-text-secondary)]">
                          —
                        </td>
                        <td className="p-2 text-right align-middle font-mono tabular-nums text-[var(--st-text)]">
                          {stock}
                        </td>
                        <td
                          className={`p-2 text-right align-middle text-[11.5px] uppercase ${
                            reorder ? 'text-[var(--st-warn)]' : 'text-[var(--st-text-secondary)]'
                          }`}
                        >
                          {reorder ? 'Yes' : 'No'}
                        </td>
                        <td className="p-2 text-right align-middle">
                          <Button size="sm" variant="ghost" asChild>
                            <Link
                              href={`/dashboard/crm/inventory/adjustments/new?productId=${productId}&warehouseId=${String(
                                row.warehouseId,
                              )}`}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Adjust
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Variants */}
      {variants.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Variants
          </h2>
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            {variants.length} variant{variants.length === 1 ? '' : 's'} linked.
          </p>
          {/* TODO 1D.2: per-variant table when variant schema lands. */}
        </Card>
      ) : null}

      {/* Suppliers / Vendors */}
      {vendorIds.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Vendors
          </h2>
          <div className="flex flex-wrap gap-2">
            {vendorIds.map((id) => (
              <EntityPickerChip
                key={String(id)}
                entity="vendor"
                id={String(id)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      </TabsContent>
      <TabsContent value="accounting" className="space-y-4">
      {/* Accounting refs */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Accounting
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Sales account">
            {(product.salesAccountId as string | undefined) ? (
              <EntityPickerChip
                entity="account"
                id={String(product.salesAccountId)}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Purchase account">
            {(product.purchaseAccountId as string | undefined) ? (
              <EntityPickerChip
                entity="account"
                id={String(product.purchaseAccountId)}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Stock account">
            {(product.stockAccountId as string | undefined) ? (
              <EntityPickerChip
                entity="account"
                id={String(product.stockAccountId)}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="COGS account">
            {(product.cogsAccountId as string | undefined) ? (
              <EntityPickerChip
                entity="account"
                id={String(product.cogsAccountId)}
              />
            ) : (
              '—'
            )}
          </DetailField>
          <DetailField label="Tax preference">
            {(product.taxPreference as string | undefined) ?? 'taxable'}
          </DetailField>
        </div>
      </Card>

      {/* Images */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Images
        </h2>
        {!thumbnail ? (
          <div className="flex h-32 items-center justify-center rounded border border-dashed border-[var(--st-border)] text-[var(--st-text-secondary)]">
            <Package className="h-8 w-8" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            {[thumbnail, ...gallery].map((src, idx) => (
              <DetailImage key={idx} src={src} alt={product.name} />
            ))}
          </div>
        )}
      </Card>

      {/* Dimensions */}
      <Card className="p-6">
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Dimensions
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DetailField label="Length">
            {product.dimensions?.length ? `${product.dimensions.length} cm` : '—'}
          </DetailField>
          <DetailField label="Breadth">
            {product.dimensions?.breadth ? `${product.dimensions.breadth} cm` : '—'}
          </DetailField>
          <DetailField label="Height">
            {product.dimensions?.height ? `${product.dimensions.height} cm` : '—'}
          </DetailField>
          <DetailField label="Volume">
            {product.dimensions?.volume ? `${product.dimensions.volume} cm³` : '—'}
          </DetailField>
          <DetailField label="Gross weight">
            {product.weight?.gross ? `${product.weight.gross} kg` : '—'}
          </DetailField>
          <DetailField label="Net weight">
            {product.weight?.net ? `${product.weight.net} kg` : '—'}
          </DetailField>
        </div>
      </Card>

      {/* Specifications */}
      {specs.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Specifications
          </h2>
          <div className="overflow-x-auto rounded-md border border-[var(--st-border)]">
            <table className="w-full text-[13px]">
              <tbody>
                {specs.map((s, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[var(--st-border)] last:border-b-0"
                  >
                    <td className="p-2 w-1/3 font-medium text-[var(--st-text)]">
                      {s.key}
                    </td>
                    <td className="p-2 text-[var(--st-text)]">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Custom attributes */}
      {customAttrs.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Custom attributes
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {customAttrs.map((a, idx) => (
              <DetailField key={idx} label={a.key}>
                {a.value}
              </DetailField>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Tags */}
      {tags ? (
        <Card className="p-6">
          <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-[11.5px] text-[var(--st-text)]"
                >
                  {t}
                </span>
              ))}
          </div>
        </Card>
      ) : null}
      </TabsContent>
    </ItemDetailTabs>
  );
}

function DetailField({
  label,
  colSpan,
  children,
}: {
  label: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  return (
    <div className={colSpan === 2 ? 'md:col-span-2' : ''}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-[13px] text-[var(--st-text)]">{children}</div>
    </div>
  );
}

function DetailImage({ src, alt }: { src: string; alt: string }) {
  const isData = src.startsWith('data:');
  if (isData) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={src}
        alt={alt}
        className="h-32 w-full rounded border border-[var(--st-border)] object-cover"
      />
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={320}
      height={128}
      className="h-32 w-full rounded border border-[var(--st-border)] object-cover"
      unoptimized
    />
  );
}
