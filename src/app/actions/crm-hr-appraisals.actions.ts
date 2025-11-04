
'use server';

import { getSession } from "@/app/actions/user.actions";
import { connectToDatabase } from "@/lib/mongodb";
import { getErrorMessage } from "@/lib/utils";
import { ObjectId, WithId } from "mongodb";
import type { CrmAppraisalReview } from '@/lib/definitions';
import { revalidatePath } from "next/cache";

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
        revalidatePath('/dashboard/crm/hr-payroll/appraisal-reviews');
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
        revalidatePath('/dashboard/crm/hr-payroll/appraisal-reviews');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
