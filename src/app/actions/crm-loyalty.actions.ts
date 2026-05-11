'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

export async function saveLoyaltyProgram(
    _prev: any,
    formData: FormData
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const name = formData.get('name') as string;
        if (!name?.trim()) {
            return { error: 'Program name is required.' };
        }

        const pointsPerCurrencyUnit = parseFloat(formData.get('pointsPerCurrencyUnit') as string) || 1;
        const redemptionRatio = parseFloat(formData.get('redemptionRatio') as string) || 100;

        const expiryDaysRaw = formData.get('expiryDays') as string;
        const expiryDays = expiryDaysRaw ? parseInt(expiryDaysRaw, 10) : undefined;

        const minRedemptionPointsRaw = formData.get('minRedemptionPoints') as string;
        const minRedemptionPoints = minRedemptionPointsRaw
            ? parseInt(minRedemptionPointsRaw, 10)
            : undefined;

        const welcomeBonusRaw = formData.get('welcomeBonus') as string;
        const welcomeBonus = welcomeBonusRaw ? parseInt(welcomeBonusRaw, 10) : undefined;

        const notes = (formData.get('notes') as string) || undefined;

        const tiersRaw = formData.get('tiers') as string;
        let tiers: Array<{ name: string; threshold: number; multiplier: number; perks: string }> = [];
        if (tiersRaw) {
            try {
                tiers = JSON.parse(tiersRaw);
            } catch {
                tiers = [];
            }
        }

        const doc: Record<string, any> = {
            userId: userObjectId,
            name: name.trim(),
            pointsPerCurrencyUnit,
            redemptionRatio,
            tiers,
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (expiryDays !== undefined) doc.expiryDays = expiryDays;
        if (minRedemptionPoints !== undefined) doc.minRedemptionPoints = minRedemptionPoints;
        if (welcomeBonus !== undefined) doc.welcomeBonus = welcomeBonus;
        if (notes) doc.notes = notes;

        const result = await db.collection('crm_loyalty_programs').insertOne(doc);

        revalidatePath('/dashboard/crm/sales/loyalty');
        return {
            message: 'Loyalty program created successfully.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
