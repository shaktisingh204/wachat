'use server';

import { getSession } from "@/app/actions/user.actions";
import { connectToDatabase } from "@/lib/mongodb";
import { getErrorMessage } from "@/lib/utils";
import { ObjectId, WithId } from "mongodb";
import type { CrmAppraisalReview } from '@/lib/definitions';
import { revalidatePath } from "next/cache";
import { recordRustFallback } from "@/lib/observability/rust-fallback-counter";
import { crmAppraisalsApi } from "@/lib/rust-client/crm-appraisals";
import { crmKpisApi } from "@/lib/rust-client/crm-kpis";
import { RustApiError } from "@/lib/rust-client/fetcher";

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/**
 * Fetch a single appraisal review scoped to the current user.
 *
 * Dual-impl: tries the Rust BFF at `/v1/crm/appraisals/{id}` when
 * `USE_RUST_CRM=true`, otherwise reads `crm_appraisal_reviews` directly.
 */
export async function getAppraisalReviewById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmAppraisalsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getAppraisalReviewById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'appraisal',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_appraisal_reviews').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch appraisal review by id:', e);
        return null;
    }
}

export async function getCrmAppraisalReviews(): Promise<WithId<CrmAppraisalReview>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const reviews = await db.collection('crm_appraisal_reviews').aggregate([
            { $match: { userId: new ObjectId(session.user._id) } },
            { $lookup: { from: 'crm_employees', localField: 'employeeId', foreignField: '_id', as: 'employeeInfo' } },
            { $unwind: '$employeeInfo' },
            { $lookup: { from: 'users', localField: 'reviewerId', foreignField: '_id', as: 'reviewerInfo' } },
            { $unwind: { path: '$reviewerInfo', preserveNullAndEmptyArrays: true } }
        ]).sort({ reviewDate: -1 }).toArray();

        return JSON.parse(JSON.stringify(reviews));
    } catch (e) {
        console.error("Failed to fetch appraisal reviews:", e);
        return [];
    }
}

export async function saveCrmAppraisalReview(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

    const id = formData.get('id') as string | null;
    const reviewData = {
        userId: new ObjectId(session.user._id),
        employeeId: new ObjectId(formData.get('employeeId') as string),
        reviewerId: new ObjectId(formData.get('reviewerId') as string),
        reviewDate: new Date(formData.get('reviewDate') as string),
        status: formData.get('status') as CrmAppraisalReview['status'],
        strengths: formData.get('strengths') as string,
        areasForImprovement: formData.get('areasForImprovement') as string,
        reviewerComments: formData.get('reviewerComments') as string,
        ratings: {
            qualityOfWork: Number(formData.get('rating_qualityOfWork')),
            communication: Number(formData.get('rating_communication')),
            teamwork: Number(formData.get('rating_teamwork')),
            problemSolving: Number(formData.get('rating_problemSolving')),
            punctuality: Number(formData.get('rating_punctuality')),
        }
    };

    if (!reviewData.employeeId || !reviewData.reviewerId || !reviewData.reviewDate) {
        return { error: 'Employee, reviewer, and review date are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        if (id && ObjectId.isValid(id)) {
            await db.collection('crm_appraisal_reviews').updateOne({ _id: new ObjectId(id) }, { $set: reviewData });
        } else {
            await db.collection('crm_appraisal_reviews').insertOne({ ...reviewData, createdAt: new Date() } as any);
        }
        revalidatePath('/dashboard/hrm/payroll/appraisal-reviews');
        return { message: 'Appraisal review saved successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmAppraisalReview(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return { success: false, error: 'Invalid request' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_appraisal_reviews').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        revalidatePath('/dashboard/hrm/payroll/appraisal-reviews');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// ── KPI Tracking ─────────────────────────────────────────────────────────────

export type CrmKpi = {
    _id: ObjectId;
    userId: ObjectId;
    employee_id: string;
    kpi_name: string;
    target_value: number;
    actual_value: number;
    unit: '%' | '$' | 'count' | string;
    period: string;
    status: 'on-track' | 'behind' | 'achieved';
    createdAt: Date;
};

export async function getCrmKpis(): Promise<WithId<CrmKpi>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const kpis = await db
            .collection('crm_kpis')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(kpis));
    } catch (e) {
        console.error('Failed to fetch KPIs:', e);
        throw new Error('Failed to fetch KPIs');
    }
}

/**
 * Fetch a single KPI document scoped to the current user.
 *
 * Dual-impl: tries the Rust BFF at `/v1/crm/kpis/{id}` when
 * `USE_RUST_CRM=true`, otherwise reads `crm_kpis` directly.
 */
export async function getKpiById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmKpisApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getKpiById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'kpi',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_kpis').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch KPI by id:', e);
        return null;
    }
}

export async function saveCrmKpi(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

    const id = formData.get('id') as string | null;
    const kpiData: Omit<CrmKpi, '_id' | 'createdAt'> = {
        userId: new ObjectId(session.user._id),
        employee_id: (formData.get('employee_id') as string) ?? '',
        kpi_name: (formData.get('kpi_name') as string) ?? '',
        target_value: Number(formData.get('target_value') ?? 0),
        actual_value: Number(formData.get('actual_value') ?? 0),
        unit: (formData.get('unit') as string) ?? '%',
        period: (formData.get('period') as string) ?? '',
        status: (formData.get('status') as CrmKpi['status']) ?? 'on-track',
    };

    if (!kpiData.kpi_name) return { error: 'KPI name is required.' };

    try {
        const { db } = await connectToDatabase();
        if (id && ObjectId.isValid(id)) {
            await db.collection('crm_kpis').updateOne({ _id: new ObjectId(id) }, { $set: kpiData });
        } else {
            await db.collection('crm_kpis').insertOne({ ...kpiData, createdAt: new Date() } as any);
        }
        revalidatePath('/dashboard/hrm/payroll/kpi-tracking');
        return { message: 'KPI saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmKpi(id: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(id)) return { success: false, error: 'Invalid request' };
    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_kpis').deleteOne({ _id: new ObjectId(id), userId: new ObjectId(session.user._id) });
        revalidatePath('/dashboard/hrm/payroll/kpi-tracking');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function bulkDeleteCrmKpis(
    ids: string[],
): Promise<{ deleted: number; failed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { deleted: 0, failed: ids.length, error: 'Access denied' };
    const validOids = ids
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
    if (validOids.length === 0) return { deleted: 0, failed: ids.length };
    try {
        const { db } = await connectToDatabase();
        const r = await db.collection('crm_kpis').deleteMany({
            _id: { $in: validOids },
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/crm/hr-payroll/kpi-tracking');
        return { deleted: r.deletedCount, failed: Math.max(0, ids.length - r.deletedCount) };
    } catch (e) {
        return { deleted: 0, failed: ids.length, error: getErrorMessage(e) };
    }
}
