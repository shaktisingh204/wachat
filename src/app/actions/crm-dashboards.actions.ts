'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmDashboardsApi } from '@/lib/rust-client/crm-dashboards';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function saveDashboard(
    _prev: any,
    formData: FormData
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const name = (formData.get('name') as string)?.trim();
        if (!name) return { error: 'Dashboard name is required.' };

        const description = (formData.get('description') as string)?.trim() || undefined;
        const layout = (formData.get('layout') as string) || '2col';
        const sharedWith = (formData.get('sharedWith') as string) || 'private';
        const isDefault = formData.get('isDefault') === 'on';

        const refreshIntervalRaw = formData.get('refreshInterval') as string;
        const refreshInterval =
            refreshIntervalRaw !== '' && refreshIntervalRaw !== null
                ? parseInt(refreshIntervalRaw, 10) || 0
                : undefined;

        const now = new Date();

        const insertResult = await db.collection('crm_dashboards').insertOne({
            name,
            ...(description !== undefined ? { description } : {}),
            layout,
            ...(refreshInterval !== undefined ? { refreshInterval } : {}),
            isDefault,
            sharedWith,
            widgets: [],
            status: 'active',
            userId: userObjectId,
            createdAt: now,
            updatedAt: now,
        });

        revalidatePath('/dashboard/crm/dashboards');
        return {
            message: 'Dashboard created. Add widgets to customize your view.',
            id: insertResult.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateDashboard(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const id = (formData.get('id') as string) || '';
    if (!id || !ObjectId.isValid(id)) {
        return { error: 'Invalid dashboard ID.' };
    }

    try {
        const { db } = await connectToDatabase();

        const name = (formData.get('name') as string)?.trim();
        if (!name) return { error: 'Dashboard name is required.' };

        const description = (formData.get('description') as string)?.trim() || '';
        const layout = (formData.get('layout') as string) || '2col';
        const sharedWith = (formData.get('sharedWith') as string) || 'private';
        const isDefault = formData.get('isDefault') === 'on';
        const status = (formData.get('status') as string) || 'active';

        const refreshIntervalRaw = formData.get('refreshInterval') as string;
        const refreshInterval =
            refreshIntervalRaw !== '' && refreshIntervalRaw !== null
                ? parseInt(refreshIntervalRaw, 10) || 0
                : 0;

        const result = await db.collection('crm_dashboards').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id),
            },
            {
                $set: {
                    name,
                    description,
                    layout,
                    refreshInterval,
                    isDefault,
                    sharedWith,
                    status,
                    updatedAt: new Date(),
                },
            },
        );

        if (result.matchedCount === 0) {
            return { error: 'Dashboard not found or permission denied.' };
        }

        revalidatePath('/dashboard/crm/dashboards');
        revalidatePath(`/dashboard/crm/dashboards/${id}`);
        return { message: 'Dashboard updated.', id };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getDashboardById(id: string): Promise<any | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmDashboardsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getDashboardById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'dashboard',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const dashboard = await db.collection('crm_dashboards').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!dashboard) return null;
        return JSON.parse(JSON.stringify(dashboard));
    } catch (e) {
        console.error('Failed to fetch dashboard by id:', e);
        return null;
    }
}
