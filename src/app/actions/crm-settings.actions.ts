'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { CrmSettings, WithId } from "@/lib/definitions";

const DEFAULT_SETTINGS = {
    companyName: '',
    companyAddress: '',
    companyEmail: '',
    companyPhone: '',
    gstin: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    financialYearStart: 'April',
    dateFormat: 'DD-MM-YYYY',

    invoicePrefix: 'INV-',
    quotationPrefix: 'QUO-',
    defaultInvoiceTerms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is delayed.',
    defaultQuotationTerms: '1. Validity: 30 Days.\n2. Delivery: 1-2 Weeks.',
    enableStockValidation: false,
    defaultTaxRate: 18,

    enableLowStockAlerts: true,
    lowStockThreshold: 10,

    standardWorkingDays: 6,
    dailyWorkingHours: 9,

    modules: {
        proforma: true,
        challans: true,
        estimates: true,
        smsNotifications: false,
        emailNotifications: false
    }
};

export async function getCrmSettings(): Promise<WithId<CrmSettings> | null> {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) return null;

    const { db } = await connectToDatabase();
    const settings = await db.collection<CrmSettings>('crm_settings').findOne({ userId: new ObjectId(session.userId) });

    if (settings) {
        return {
            ...settings,
            _id: settings._id.toString(),
            userId: settings.userId.toString(),
            // Ensure compatibility if new fields added later
            modules: { ...DEFAULT_SETTINGS.modules, ...settings.modules }
        } as any;
    }

    return {
        ...DEFAULT_SETTINGS,
        _id: 'default', // Placeholder
        userId: session.userId,
        updatedAt: new Date()
    } as any;
}

export async function saveCrmSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) return { error: 'Unauthorized' };

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.userId);

    const rawModules = {
        proforma: formData.get('module_proforma') === 'on',
        challans: formData.get('module_challans') === 'on',
        estimates: formData.get('module_estimates') === 'on',
        smsNotifications: formData.get('module_smsNotifications') === 'on',
        emailNotifications: formData.get('module_emailNotifications') === 'on',
    };

    const settingsData: Partial<CrmSettings> = {
        companyName: formData.get('companyName') as string,
        companyAddress: formData.get('companyAddress') as string,
        companyEmail: formData.get('companyEmail') as string,
        companyPhone: formData.get('companyPhone') as string,
        gstin: formData.get('gstin') as string,
        currency: formData.get('currency') as string,
        timezone: formData.get('timezone') as string,
        financialYearStart: formData.get('financialYearStart') as string,
        dateFormat: formData.get('dateFormat') as string,

        invoicePrefix: formData.get('invoicePrefix') as string,
        quotationPrefix: formData.get('quotationPrefix') as string,
        defaultInvoiceTerms: formData.get('defaultInvoiceTerms') as string,
        defaultQuotationTerms: formData.get('defaultQuotationTerms') as string,
        enableStockValidation: formData.get('enableStockValidation') === 'on',
        defaultTaxRate: Number(formData.get('defaultTaxRate')),

        enableLowStockAlerts: formData.get('enableLowStockAlerts') === 'on',
        lowStockThreshold: Number(formData.get('lowStockThreshold')),

        standardWorkingDays: Number(formData.get('standardWorkingDays')),
        dailyWorkingHours: Number(formData.get('dailyWorkingHours')),

        modules: rawModules,
        updatedAt: new Date(),
    };

    try {
        await db.collection('crm_settings').updateOne(
            { userId: userObjectId },
            { $set: { ...settingsData, userId: userObjectId } },
            { upsert: true }
        );
        return { message: 'Settings updated successfully!' };
    } catch (error) {
        console.error('Save Settings Error:', error);
        return { error: 'Failed to save settings.' };
    }
}
