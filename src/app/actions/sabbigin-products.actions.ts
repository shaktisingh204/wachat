'use server';

/**
 * SabBigin product server actions — a lean, micro-business catalogue surface.
 *
 * The full CRM's `saveCrmProduct` carries inventory, warehouses, dimensions,
 * tax, suppliers, brands and units. SabBigin deliberately does NOT. These
 * actions write only the handful of fields a small business needs:
 *   name, sku, price, currency, description.
 *
 * They write directly to the `crm_products` collection, scoped by `userId`,
 * so the existing read path (`getCrmProducts` / `getCrmProductById`) keeps
 * working unchanged. No Rust BFF involvement — this is the simplest possible
 * Mongo path on purpose.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

const PRODUCTS_PATH = '/dashboard/sabbigin/products';

export interface SabbiginProductResult {
    ok: boolean;
    error?: string;
    /** Serialised product row on success (stringly typed _id). */
    product?: {
        _id: string;
        name: string;
        sku: string;
        price: number;
        currency: string;
        description: string;
    };
}

/** Coerce a raw FormData price into a finite, non-negative number. */
function readPrice(formData: FormData): number {
    const raw = formData.get('price');
    if (raw == null || raw === '') return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function revalidate(productId?: string): void {
    revalidatePath(PRODUCTS_PATH);
    if (productId) revalidatePath(`${PRODUCTS_PATH}/${productId}`);
}

/* ─── createSabbiginProduct ──────────────────────────────────────────────
 * useActionState-shaped: (prevState, formData) → SabbiginProductResult.
 * Reads: name (required), sku, price, currency, description.
 */
export async function createSabbiginProduct(
    _prevState: SabbiginProductResult | null,
    formData: FormData,
): Promise<SabbiginProductResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const name = ((formData.get('name') as string | null) ?? '').trim();
    if (!name) return { ok: false, error: 'Product name is required.' };

    const sku = ((formData.get('sku') as string | null) ?? '').trim();
    const currency = ((formData.get('currency') as string | null) || 'INR').trim();
    const description = ((formData.get('description') as string | null) ?? '').trim();
    const price = readPrice(formData);

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc = {
            name,
            sku,
            price,
            currency,
            description,
            userId: new ObjectId(session.user._id),
            createdAt: now,
            updatedAt: now,
        };
        const result = await db.collection('crm_products').insertOne(doc);
        revalidate(String(result.insertedId));

        return {
            ok: true,
            product: {
                _id: String(result.insertedId),
                name,
                sku,
                price,
                currency,
                description,
            },
        };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}

/* ─── updateSabbiginProduct ──────────────────────────────────────────────
 * useActionState-shaped: (prevState, formData) → SabbiginProductResult.
 * Reads: productId (required), name (required), sku, price, currency, description.
 */
export async function updateSabbiginProduct(
    _prevState: SabbiginProductResult | null,
    formData: FormData,
): Promise<SabbiginProductResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied.' };

    const productId = ((formData.get('productId') as string | null) ?? '').trim();
    if (!productId || !ObjectId.isValid(productId)) {
        return { ok: false, error: 'Invalid product id.' };
    }

    const name = ((formData.get('name') as string | null) ?? '').trim();
    if (!name) return { ok: false, error: 'Product name is required.' };

    const sku = ((formData.get('sku') as string | null) ?? '').trim();
    const currency = ((formData.get('currency') as string | null) || 'INR').trim();
    const description = ((formData.get('description') as string | null) ?? '').trim();
    const price = readPrice(formData);

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_products').updateOne(
            {
                _id: new ObjectId(productId),
                userId: new ObjectId(session.user._id),
            },
            {
                $set: {
                    name,
                    sku,
                    price,
                    currency,
                    description,
                    updatedAt: new Date(),
                },
            },
        );

        if (result.matchedCount === 0) {
            return { ok: false, error: 'Product not found.' };
        }

        revalidate(productId);
        return {
            ok: true,
            product: { _id: productId, name, sku, price, currency, description },
        };
    } catch (e) {
        return { ok: false, error: getErrorMessage(e) };
    }
}
