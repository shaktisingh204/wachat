
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type Filter, WithId } from 'mongodb';
import { getAdminSession } from '@/app/actions/admin.actions';
import { connectToDatabase } from '@/lib/mongodb';
import type { Plan, PlanFeaturePermissions, TemplateCategory } from '@/lib/definitions';
import { planFeaturesDefaults } from '@/lib/plans';

export async function getPlans(filter?: Filter<Plan>): Promise<WithId<Plan>[]> {
    try {
        const { db } = await connectToDatabase();
        const plans = await db.collection('plans').find((filter || {}) as any).sort({ price: 1 }).toArray();
        return JSON.parse(JSON.stringify(plans));
    } catch (error) {
        console.error("Failed to fetch plans:", error);
        return [];
    }
}

export async function getPlanById(planId: string): Promise<WithId<Plan> | null> {
    if (!ObjectId.isValid(planId)) return null;
    try {
        const { db } = await connectToDatabase();
        const plan = await db.collection('plans').findOne({ _id: new ObjectId(planId) });
        return plan ? JSON.parse(JSON.stringify(plan)) : null;
    } catch (error) {
        console.error('Failed to fetch plan by ID:', error);
        return null;
    }
}

export async function savePlan(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const planId = formData.get('planId') as string;
    const isNew = planId === 'new';

    try {
        // Load existing features so we only overwrite keys the form actually sent.
        // Historically the editor had no UI for `plan.features` while savePlan still
        // iterated `planFeaturesDefaults` — that quietly wrote every flag to `false`
        // on every save. We now treat the form as authoritative only when it explicitly
        // carries a `__featuresSubmitted=1` marker (i.e. the Features tab is mounted).
        const featuresSubmitted = formData.get('__featuresSubmitted') === '1';

        let existingFeatures: Partial<PlanFeaturePermissions> = {};
        if (!isNew && ObjectId.isValid(planId)) {
            try {
                const { db: readDb } = await connectToDatabase();
                const existing = await readDb
                    .collection<Plan>('plans')
                    .findOne(
                        { _id: new ObjectId(planId) },
                        { projection: { features: 1 } },
                    );
                existingFeatures = (existing?.features as any) || {};
            } catch (e) {
                console.error('savePlan: failed to load existing features', e);
            }
        }

        const features: Partial<PlanFeaturePermissions> = {};
        for (const key of Object.keys(planFeaturesDefaults)) {
            if (featuresSubmitted) {
                features[key as keyof PlanFeaturePermissions] = formData.get(key) === 'on';
            } else {
                // No Features tab submission → keep whatever is already on the plan,
                // falling back to the defaults (all true) for brand-new plans.
                features[key as keyof PlanFeaturePermissions] =
                    existingFeatures[key as keyof PlanFeaturePermissions] ??
                    planFeaturesDefaults[key as keyof PlanFeaturePermissions];
            }
        }

        const planData: Omit<Plan, '_id' | 'createdAt'> = {
            name: formData.get('name') as string,
            price: Number(formData.get('price')),
            currency: formData.get('currency') as string,
            appCategory: formData.get('appCategory') as Plan['appCategory'],
            isPublic: formData.get('isPublic') === 'on',
            isDefault: formData.get('isDefault') === 'on',
            projectLimit: Number(formData.get('projectLimit')),
            agentLimit: Number(formData.get('agentLimit')),
            attributeLimit: Number(formData.get('attributeLimit')),
            templateLimit: Number(formData.get('templateLimit')),
            flowLimit: Number(formData.get('flowLimit')),
            metaFlowLimit: Number(formData.get('metaFlowLimit')),
            cannedMessageLimit: Number(formData.get('cannedMessageLimit')),
            signupCredits: Number(formData.get('signupCredits') || 0),
            initialCredits: {
                broadcast: Number(formData.get('init_broadcast') ?? 0),
                sms: Number(formData.get('init_sms') ?? 0),
                meta: Number(formData.get('init_meta') ?? 0),
                email: Number(formData.get('init_email') ?? 0),
            },
            customRoleLimit: Number(formData.get('customRoleLimit') ?? 3),
            teamChannelLimit: Number(formData.get('teamChannelLimit') ?? 10),
            teamTaskLimit: Number(formData.get('teamTaskLimit') ?? 50),
            messageCosts: {
                marketing: Number(formData.get('cost_marketing')),
                utility: Number(formData.get('cost_utility')),
                authentication: Number(formData.get('cost_authentication')),
            },
            rates: {
                whatsapp_marketing: Number(formData.get('rate_whatsapp_marketing') ?? 1),
                whatsapp_utility: Number(formData.get('rate_whatsapp_utility') ?? 1),
                whatsapp_authentication: Number(formData.get('rate_whatsapp_authentication') ?? 1),
                sms: Number(formData.get('rate_sms') ?? 1),
                meta: Number(formData.get('rate_meta') ?? 1),
                email: Number(formData.get('rate_email') ?? 1),
            },
            appLimits: {
                wachat: {
                    templates: Number(formData.get('limit_wachat_templates') ?? 0),
                    flows: Number(formData.get('limit_wachat_flows') ?? 0),
                    metaFlows: Number(formData.get('limit_wachat_metaFlows') ?? 0),
                    cannedMessages: Number(formData.get('limit_wachat_cannedMessages') ?? 0),
                },
                crm: {
                    products: Number(formData.get('limit_crm_products') ?? 0),
                    customers: Number(formData.get('limit_crm_customers') ?? 0),
                    vendors: Number(formData.get('limit_crm_vendors') ?? 0),
                    warehouses: Number(formData.get('limit_crm_warehouses') ?? 0),
                    pipelines: Number(formData.get('limit_crm_pipelines') ?? 0),
                },
                facebook: {
                    pages: Number(formData.get('limit_fb_pages') ?? 0),
                    scheduledPosts: Number(formData.get('limit_fb_scheduled') ?? 0),
                    automationRules: Number(formData.get('limit_fb_automation') ?? 0),
                    shops: Number(formData.get('limit_fb_shops') ?? 0),
                },
                instagram: {
                    accounts: Number(formData.get('limit_ig_accounts') ?? 0),
                    scheduledPosts: Number(formData.get('limit_ig_scheduled') ?? 0),
                    hashtagTracking: Number(formData.get('limit_ig_hashtags') ?? 0),
                },
                adManager: {
                    adAccounts: Number(formData.get('limit_ads_accounts') ?? 0),
                    campaigns: Number(formData.get('limit_ads_campaigns') ?? 0),
                    audiences: Number(formData.get('limit_ads_audiences') ?? 0),
                    monthlyAdSpendCap: Number(formData.get('limit_ads_spend_cap') ?? 0),
                },
                email: {
                    connectedAccounts: Number(formData.get('limit_email_connectedAccounts') ?? 0),
                    dailyLimit: Number(formData.get('limit_email_dailyLimit') ?? 0),
                },
                sms: {
                    dailyLimit: Number(formData.get('limit_sms_dailyLimit') ?? 0),
                },
                sabchat: {
                    widgets: Number(formData.get('limit_sabchat_widgets') ?? 0),
                    monthlyVisitors: Number(formData.get('limit_sabchat_visitors') ?? 0),
                    quickReplies: Number(formData.get('limit_sabchat_replies') ?? 0),
                },
                seo: {
                    projects: Number(formData.get('limit_seo_projects') ?? 0),
                    brandRadars: Number(formData.get('limit_seo_radars') ?? 0),
                    trackedKeywords: Number(formData.get('limit_seo_keywords') ?? 0),
                },
                websiteBuilder: {
                    sites: Number(formData.get('limit_site_sites') ?? 0),
                    pages: Number(formData.get('limit_site_pages') ?? 0),
                    customDomains: Number(formData.get('limit_site_domains') ?? 0),
                },
                urlShortener: {
                    links: Number(formData.get('limit_url_links') ?? 0),
                    domains: Number(formData.get('limit_url_domains') ?? 0),
                },
                qrCode: {
                    limit: Number(formData.get('limit_qrcode_limit') ?? 0),
                },
            },
            features: features as PlanFeaturePermissions,
            permissions: {}, // Will populate below
        };

        // Parse the permissions blob emitted by <PlanPermissionSelector />.
        // Structure: flat { [moduleKey]: { view, create, edit, delete } }
        // Fall back to legacy formData iteration if the JSON field is absent.
        const permissionsJson = formData.get('permissionsJson') as string | null;
        let permissions: Record<string, Record<string, boolean>> = {};

        if (permissionsJson) {
            try {
                const parsed = JSON.parse(permissionsJson);
                // Accept either flat or nested-under-`agent` legacy shape.
                if (parsed && typeof parsed === 'object') {
                    const source = parsed.agent && !parsed.wachat_overview ? parsed.agent : parsed;
                    permissions = source;
                }
            } catch (e) {
                console.error('Failed to parse permissionsJson, falling back to {}', e);
                permissions = {};
            }
        } else {
            // Legacy fallback: iterate named checkbox inputs
            const { globalModules, permissionActions } = require('@/lib/permission-modules');
            for (const module of globalModules) {
                permissions[module] = {} as any;
                for (const action of permissionActions) {
                    const key = `${module}_${action}`;
                    permissions[module][action] = formData.get(key) === 'on';
                }
            }
        }
        planData.permissions = permissions as any;

        if (!planData.name || isNaN(planData.price)) {
            return { error: 'Plan name and price are required.' };
        }

        const { db } = await connectToDatabase();

        if (planData.isDefault) {
            await db.collection('plans').updateMany({ _id: { $ne: isNew ? new ObjectId() : new ObjectId(planId) } }, { $set: { isDefault: false } });
        }

        if (isNew) {
            await db.collection('plans').insertOne({ ...planData, createdAt: new Date() } as any);
        } else {
            await db.collection('plans').updateOne({ _id: new ObjectId(planId) }, { $set: planData });
        }

        revalidatePath('/admin/dashboard/plans');
        return { message: `Plan "${planData.name}" has been saved successfully.` };

    } catch (e: any) {
        console.error('Failed to save plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function deletePlan(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const planId = formData.get('planId') as string;
    if (!planId || !ObjectId.isValid(planId)) {
        return { error: 'Invalid Plan ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const planObjectId = new ObjectId(planId);

        const plan = await db.collection('plans').findOne({ _id: planObjectId });
        if (plan?.isDefault) {
            return { error: 'Cannot delete the default plan.' };
        }

        await db.collection('plans').deleteOne({ _id: planObjectId });

        revalidatePath('/admin/dashboard/plans');
        return { message: `Plan successfully deleted.` };

    } catch (e: any) {
        console.error('Failed to delete plan:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function getTemplateCategories(): Promise<WithId<TemplateCategory>[]> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return [];
    try {
        const { db } = await connectToDatabase();
        return JSON.parse(JSON.stringify(await db.collection('template_categories').find({}).sort({ name: 1 }).toArray()));
    } catch (e) {
        console.error("Failed to fetch template categories:", e);
        return [];
    }
}

export async function saveTemplateCategory(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    if (!name) return { error: 'Category name is required.' };

    try {
        const { db } = await connectToDatabase();
        const existing = await db.collection('template_categories').findOne({ name });
        if (existing) return { error: 'A category with this name already exists.' };
        await db.collection('template_categories').insertOne({ name, description, createdAt: new Date() });
        revalidatePath('/admin/dashboard/template-library');
        return { message: 'Category created successfully.' };
    } catch (e: any) {
        console.error('Failed to create category:', e);
        return { error: 'Failed to create category.' };
    }
}

export async function deleteTemplateCategory(id: string): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };

    if (!ObjectId.isValid(id)) return { error: 'Invalid category ID.' };
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('template_categories').deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return { error: 'Could not find the category to delete.' };
        }
        revalidatePath('/admin/dashboard/template-library');
        return { message: 'Category deleted successfully.' };
    } catch (e: any) {
        console.error('Failed to delete category:', e);
        return { error: 'Failed to delete category.' };
    }
}
