/**
 * Shopify product CSV importer.
 *
 * Maps Shopify's standard product export columns into our `Product` schema.
 * Multi-row variants (same Handle, different Option columns) are folded into
 * the `variants[]` of a single product.
 */

import 'server-only';
import { createProduct, getProductBySlug, updateProduct } from '../products';
import type { Product, Variant, ProductVariantOption, CommerceCurrency } from '../types';

export interface ShopifyImportOptions {
    tenantId: string;
    /** Default currency if Shopify's row doesn't carry one. */
    currency?: CommerceCurrency;
    /** When true, existing products with same slug are updated instead of duplicated. */
    upsert?: boolean;
}

export interface ShopifyImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ handle: string; error: string }>;
}

/**
 * Naive RFC4180-style CSV parser. Sufficient for Shopify exports which use
 * standard quoting. Returns rows of `string[]`.
 */
export function parseCsv(input: string): string[][] {
    const rows: string[][] = [];
    let i = 0;
    let cell = '';
    let row: string[] = [];
    let inQuotes = false;
    while (i < input.length) {
        const ch = input[i];
        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    cell += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i++;
                continue;
            }
            cell += ch;
            i++;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            i++;
            continue;
        }
        if (ch === ',') {
            row.push(cell);
            cell = '';
            i++;
            continue;
        }
        if (ch === '\r') {
            i++;
            continue;
        }
        if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            i++;
            continue;
        }
        cell += ch;
        i++;
    }
    if (cell.length > 0 || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

interface ShopifyRow {
    Handle: string;
    Title?: string;
    'Body (HTML)'?: string;
    Vendor?: string;
    Type?: string;
    Tags?: string;
    Published?: string;
    'Option1 Name'?: string;
    'Option1 Value'?: string;
    'Option2 Name'?: string;
    'Option2 Value'?: string;
    'Option3 Name'?: string;
    'Option3 Value'?: string;
    'Variant SKU'?: string;
    'Variant Grams'?: string;
    'Variant Price'?: string;
    'Variant Compare At Price'?: string;
    'Variant Barcode'?: string;
    'Image Src'?: string;
    'SEO Title'?: string;
    'SEO Description'?: string;
    Status?: string;
}

function rowToObj(headers: string[], row: string[]): ShopifyRow {
    const o: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
        o[headers[i]] = row[i] ?? '';
    }
    return o as unknown as ShopifyRow;
}

function priceToCents(s: string | undefined): number {
    if (!s) return 0;
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
}

function buildVariant(row: ShopifyRow, idx: number): Variant {
    const opts: ProductVariantOption[] = [];
    for (const i of [1, 2, 3] as const) {
        const name = row[`Option${i} Name` as keyof ShopifyRow];
        const value = row[`Option${i} Value` as keyof ShopifyRow];
        if (name && value && value !== 'Default Title') {
            opts.push({ name, value });
        }
    }
    return {
        id: `${row.Handle}-${idx}`,
        sku: row['Variant SKU'] || `${row.Handle}-${idx}`,
        title: opts.map((o) => o.value).join(' / ') || undefined,
        options: opts,
        priceCents: priceToCents(row['Variant Price']),
        compareAtCents: row['Variant Compare At Price'] ? priceToCents(row['Variant Compare At Price']) : undefined,
        weightGrams: row['Variant Grams'] ? parseFloat(row['Variant Grams']) : undefined,
        barcode: row['Variant Barcode'] || undefined,
        imageUrl: row['Image Src'] || undefined,
    };
}

export async function importShopifyCsv(
    csv: string,
    opts: ShopifyImportOptions,
): Promise<ShopifyImportResult> {
    const result: ShopifyImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const rows = parseCsv(csv);
    if (rows.length < 2) return result;
    const headers = rows[0];
    const grouped = new Map<string, ShopifyRow[]>();
    for (let i = 1; i < rows.length; i++) {
        const obj = rowToObj(headers, rows[i]);
        if (!obj.Handle) continue;
        const arr = grouped.get(obj.Handle) ?? [];
        arr.push(obj);
        grouped.set(obj.Handle, arr);
    }

    for (const [handle, items] of grouped) {
        try {
            const head = items[0];
            const variants = items
                .filter((r) => r['Variant SKU'] || r['Variant Price'])
                .map((r, idx) => buildVariant(r, idx));
            const tags = head.Tags
                ? head.Tags.split(',').map((t) => t.trim()).filter(Boolean)
                : undefined;
            const product: Omit<Product, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
                tenantId: opts.tenantId,
                slug: handle,
                title: head.Title ?? handle,
                description: head['Body (HTML)'] || undefined,
                kind: 'physical',
                currency: opts.currency ?? 'USD',
                priceCents: variants[0]?.priceCents ?? 0,
                compareAtCents: variants[0]?.compareAtCents,
                sku: variants[0]?.sku,
                variants: variants.length > 1 ? variants : [],
                tags,
                seoTitle: head['SEO Title'] || undefined,
                seoDescription: head['SEO Description'] || undefined,
                images: variants
                    .map((v) => v.imageUrl)
                    .filter((u): u is string => Boolean(u)),
                status: head.Status === 'active' || head.Published === 'TRUE' ? 'active' : 'draft',
            };

            if (opts.upsert) {
                const existing = await getProductBySlug(opts.tenantId, handle);
                if (existing) {
                    await updateProduct(opts.tenantId, existing._id!, product);
                    result.updated++;
                    continue;
                }
            }
            await createProduct(product);
            result.created++;
        } catch (e) {
            result.errors.push({ handle, error: e instanceof Error ? e.message : String(e) });
            result.skipped++;
        }
    }
    return result;
}
