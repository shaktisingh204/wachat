'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

export async function getLoyaltyProgramById(
    loyaltyId: string,
): Promise<Record<string, any> | null> {
    if (!loyaltyId || !ObjectId.isValid(loyaltyId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_loyalty_programs').findOne({
            _id: new ObjectId(loyaltyId),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('getLoyaltyProgramById error:', e);
        return null;
    }
}

export async function updateLoyaltyProgram(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const loyaltyId = (formData.get('loyaltyId') as string | null) || '';
    if (!loyaltyId || !ObjectId.isValid(loyaltyId)) {
        return { error: 'Invalid loyalty program id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const name = (formData.get('name') as string | null)?.trim() || '';
        if (!name) return { error: 'Program name is required.' };

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
        const status = (formData.get('status') as string) || undefined;

        const $set: Record<string, any> = {
            name,
            pointsPerCurrencyUnit,
            redemptionRatio,
            updatedAt: new Date(),
        };
        if (expiryDays !== undefined) $set.expiryDays = expiryDays;
        if (minRedemptionPoints !== undefined) $set.minRedemptionPoints = minRedemptionPoints;
        if (welcomeBonus !== undefined) $set.welcomeBonus = welcomeBonus;
        if (notes !== undefined) $set.notes = notes;
        if (status) $set.status = status;

        const result = await db.collection('crm_loyalty_programs').updateOne(
            { _id: new ObjectId(loyaltyId), userId: userObjectId },
            { $set },
        );

        if (result.matchedCount === 0) {
            return { error: 'Loyalty program not found.' };
        }

        revalidatePath('/dashboard/crm/sales/loyalty');
        revalidatePath(`/dashboard/crm/sales/loyalty/${loyaltyId}`);
        return { message: 'Loyalty program updated successfully.', id: loyaltyId };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

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
