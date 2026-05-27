'use server';

/**
 * CRM Careers Page — server-action wrappers around the legacy
 * `crm_careers_pages` Mongo collection.
 *
 * Single settings document per tenant. No Rust crate yet — direct
 * Mongo reads/writes.
 *
 * Document shape (camelCase, per the task spec):
 * ```
 * {
 *   _id: ObjectId,
 *   userId: ObjectId,
 *   enabled: boolean,
 *   brandLogoUrl?: string,    // SabFile URL
 *   bannerImageUrl?: string,  // SabFile URL
 *   aboutCompany?: string,
 *   perks: string[],
 *   contactEmail?: string,
 *   customDomain?: string,
 *   socialLinks: {
 *     linkedin?: string,
 *     twitter?: string,
 *     facebook?: string,
 *     instagram?: string,
 *     youtube?: string,
 *     website?: string,
 *   },
 *   createdAt: Date,
 *   updatedAt: Date,
 * }
 * ```
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface CrmCareersPageSocialLinks {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    website?: string;
}

interface CrmCareersPageDoc {
    _id: string;
    userId: string;
    enabled: boolean;
    brandLogoUrl?: string;
    bannerImageUrl?: string;
    aboutCompany?: string;
    perks: string[];
    contactEmail?: string;
    customDomain?: string;
    socialLinks: CrmCareersPageSocialLinks;
    createdAt?: string;
    updatedAt?: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function asArray(v: FormDataEntryValue | null): string[] {
    const s = asString(v);
    if (!s) return [];
    return s
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
}

function toDoc(raw: WithId<Record<string, unknown>> | null): CrmCareersPageDoc | null {
    if (!raw) return null;
    const j = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
    const social = (j.socialLinks as Record<string, unknown> | undefined) ?? {};
    return {
        _id: String(j._id),
        userId: String(j.userId),
        enabled: Boolean(j.enabled ?? false),
        brandLogoUrl: (j.brandLogoUrl as string | undefined) ?? undefined,
        bannerImageUrl: (j.bannerImageUrl as string | undefined) ?? undefined,
        aboutCompany: (j.aboutCompany as string | undefined) ?? undefined,
        perks: Array.isArray(j.perks) ? (j.perks as string[]) : [],
        contactEmail: (j.contactEmail as string | undefined) ?? undefined,
        customDomain: (j.customDomain as string | undefined) ?? undefined,
        socialLinks: {
            linkedin: (social.linkedin as string | undefined) ?? undefined,
            twitter: (social.twitter as string | undefined) ?? undefined,
            facebook: (social.facebook as string | undefined) ?? undefined,
            instagram: (social.instagram as string | undefined) ?? undefined,
            youtube: (social.youtube as string | undefined) ?? undefined,
            website: (social.website as string | undefined) ?? undefined,
        },
        createdAt: (j.createdAt as string | undefined) ?? undefined,
        updatedAt: (j.updatedAt as string | undefined) ?? undefined,
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCrmCareersPage(): Promise<CrmCareersPageDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const guard = await requirePermission('crm_careers_page', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection('crm_careers_pages')
            .findOne({ userId: new ObjectId(session.user._id) });
        return toDoc(doc);
    } catch (e) {
        console.error('[getCrmCareersPage] failed:', getErrorMessage(e));
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCrmCareersPage(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const guard = await requirePermission('crm_careers_page', 'edit');
    if (!guard.ok) return { error: guard.error };

    const payload: Record<string, unknown> = {
        enabled: asBool(formData.get('enabled')),
        brandLogoUrl: asString(formData.get('brandLogoUrl')),
        bannerImageUrl: asString(formData.get('bannerImageUrl')),
        aboutCompany: asString(formData.get('aboutCompany')),
        perks: asArray(formData.get('perks')),
        contactEmail: asString(formData.get('contactEmail')),
        customDomain: asString(formData.get('customDomain')),
        socialLinks: {
            linkedin: asString(formData.get('linkedin')),
            twitter: asString(formData.get('twitter')),
            facebook: asString(formData.get('facebook')),
            instagram: asString(formData.get('instagram')),
            youtube: asString(formData.get('youtube')),
            website: asString(formData.get('website')),
        },
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const existing = await db
            .collection('crm_careers_pages')
            .findOne({ userId });

        if (existing) {
            await db.collection('crm_careers_pages').updateOne(
                { _id: existing._id, userId },
                { $set: payload },
            );
            revalidatePath('/dashboard/hrm/hr/careers-page');
            return {
                message: 'Careers page updated.',
                id: existing._id.toString(),
            };
        }

        payload.userId = userId;
        payload.createdAt = new Date();
        const result = await db.collection('crm_careers_pages').insertOne(payload);
        revalidatePath('/dashboard/hrm/hr/careers-page');
        return {
            message: 'Careers page created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save careers page: ${getErrorMessage(e)}` };
    }
}
