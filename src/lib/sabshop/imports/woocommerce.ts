/**
 * WooCommerce CSV / XML export importer.
 *
 * Supports the standard "Product CSV Import Suite" column set produced by
 * WooCommerce. Variable products are split across rows by `Type` ("variable"
 * for the parent, "variation" for each child) keyed on `Parent`.
 */

import 'server-only';
import { createProduct, getProductBySlug, updateProduct } from '../products';
import { parseCsv } from './shopify';
import type { Product, Variant, ProductVariantOption, CommerceCurrency } from '../types';

export interface WooImportOptions {
    tenantId: string;
    currency?: CommerceCurrency;
    upsert?: boolean;
}

export interface WooImportResult {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ sku: string; error: string }>;
}

interface WooRow {
    ID?: string;
    Type?: string;
    SKU?: string;
    Name?: string;
    Published?: string;
    'Is featured?'?: string;
    'Visibility in catalog'?: string;
    'Short description'?: string;
    Description?: string;
    'Tax status'?: string;
    'Tax class'?: string;
    'In stock?'?: string;
    Stock?: string;
    'Backorders allowed?'?: string;
    'Weight (kg)'?: string;
    'Length (cm)'?: string;
    'Width (cm)'?: string;
    'Height (cm)'?: string;
    'Sale price'?: string;
    'Regular price'?: string;
    Categories?: string;
    Tags?: string;
    Images?: string;
    Parent?: string;
    /** Attributes — Woo uses Attribute 1 name/value, etc. */
    [key: string]: string | undefined;
}

function rowToObj(headers: string[], row: string[]): WooRow {
    const o: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
        o[headers[i]] = row[i] ?? '';
    }
    return o as WooRow;
}

function priceToCents(s: string | undefined): number {
    if (!s) return 0;
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
}

function buildVariant(row: WooRow, idx: number): Variant {
    const opts: ProductVariantOption[] = [];
    for (let i = 1; i <= 5; i++) {
        const name = row[`Attribute ${i} name`];
        const value = row[`Attribute ${i} value(s)`];
        if (name && value) opts.push({ name, value: value.split('|')[0].trim() });
    }
    const price = row['Sale price'] || row['Regular price'];
    return {
        id: `${row.Parent || row.SKU || idx}-${idx}`,
        sku: row.SKU || `var-${idx}`,
        title: opts.map((o) => o.value).join(' / ') || undefined,
        options: opts,
        priceCents: priceToCents(price),
        compareAtCents: row['Sale price'] ? priceToCents(row['Regular price']) : undefined,
        weightGrams: row['Weight (kg)'] ? Math.round(parseFloat(row['Weight (kg)']) * 1000) : undefined,
        imageUrl: row.Images ? row.Images.split(',')[0]?.trim() : undefined,
    };
}

export async function importWooCommerceCsv(
    csv: string,
    opts: WooImportOptions,
): Promise<WooImportResult> {
    const result: WooImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const rows = parseCsv(csv);
    if (rows.length < 2) return result;
    const headers = rows[0];
    const objs: WooRow[] = rows.slice(1).map((r) => rowToObj(headers, r));

    // Parents (simple or variable)
    const parents = objs.filter((r) => r.Type !== 'variation');
    const variations = objs.filter((r) => r.Type === 'variation');

    // Index variations by their parent SKU.
    const varBySku = new Map<string, WooRow[]>();
    for (const v of variations) {
        const key = v.Parent || '';
        const arr = varBySku.get(key) ?? [];
        arr.push(v);
        varBySku.set(key, arr);
    }

    for (const head of parents) {
        const parentSku = head.SKU || head.Name || '';
        try {
            const slug = (head.Name ?? parentSku)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');
            const childRows = head.Type === 'variable' ? varBySku.get(parentSku) ?? [] : [];
            const variants = childRows.map((r, idx) => buildVariant(r, idx));
            const tags = head.Tags
                ? head.Tags.split(',').map((t) => t.trim()).filter(Boolean)
                : undefined;
            const categories = head.Categories
                ? head.Categories.split(',').map((c) => c.trim()).filter(Boolean)
                : undefined;
            const images = head.Images
                ? head.Images.split(',').map((i) => i.trim()).filter(Boolean)
                : undefined;

            const isDigital = (head['Tax class'] ?? '').toLowerCase().includes('digital') || head.Type === 'downloadable';
            const product: Omit<Product, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'> = {
                tenantId: opts.tenantId,
                slug,
                title: head.Name ?? parentSku,
                description: head.Description || head['Short description'] || undefined,
                kind: isDigital ? 'digital' : 'physical',
                currency: opts.currency ?? 'USD',
                priceCents: priceToCents(head['Sale price'] || head['Regular price']),
                compareAtCents: head['Sale price'] ? priceToCents(head['Regular price']) : undefined,
                sku: parentSku || undefined,
                variants,
                tags,
                categoryIds: categories,
                images,
                status: head.Published === '1' ? 'active' : 'draft',
            };

            if (opts.upsert) {
                const existing = await getProductBySlug(opts.tenantId, slug);
                if (existing) {
                    await updateProduct(opts.tenantId, existing._id!, product);
                    result.updated++;
                    continue;
                }
            }
            await createProduct(product);
            result.created++;
        } catch (e) {
            result.errors.push({ sku: parentSku, error: e instanceof Error ? e.message : String(e) });
            result.skipped++;
        }
    }
    return result;
}
