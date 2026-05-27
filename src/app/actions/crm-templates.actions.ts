'use server';

import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

interface UnifiedTemplate {
    _id?: string | ObjectId;
    userId: string | ObjectId;
    name: string;
    type: 'email' | 'sms' | 'whatsapp' | 'document';
    subject?: string;
    content: string; // HTML for Email, Text for SMS, Body Text for WhatsApp, JSON String for Document
    themeColor?: string;
    fontFamily?: string;
    status: 'active' | 'archived';
    whatsappConfig?: {
        headerType: 'text' | 'image' | 'document' | 'none';
        headerText?: string;
        headerUrl?: string;
        footerText?: string;
        buttons: Array<{
            type: 'quick_reply' | 'url' | 'call';
            text: string;
            value?: string;
        }>;
    };
    documentConfig?: {
        headerLogo?: string;
        headerAddress?: string;
        footerTerms?: string;
        margins?: 'normal' | 'compact' | 'wide';
        showSignature: boolean;
        showItemsTable: boolean;
    };
    emailConfig?: {
        blocks: Array<{
            id: string;
            type: 'header' | 'text' | 'image' | 'button' | 'columns' | 'divider' | 'footer';
            content: any;
            style?: any;
        }>;
    };
    versionHistory?: Array<{
        versionId: string;
        timestamp: string | Date;
        content: string;
        subject?: string;
        description: string;
        emailConfig?: any;
        whatsappConfig?: any;
        documentConfig?: any;
    }>;
    createdAt?: Date;
    updatedAt?: Date;
}

// Resilient in-memory fallback store if database is offline during staging
const inMemoryTemplatesStore = new Map<string, UnifiedTemplate[]>();

async function getUserId(): Promise<string> {
    const session = await getSession();
    return session?.user?._id?.toString() || 'demo-user-id';
}

export async function getCrmUnifiedTemplates(): Promise<UnifiedTemplate[]> {
    const userId = await getUserId();
    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection<UnifiedTemplate>('crm_unified_templates')
            .find({ userId: userId.length === 24 ? new ObjectId(userId) : userId })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (e) {
        console.warn("MongoDB offline, falling back to local memory store:", e);
        const list = inMemoryTemplatesStore.get(userId) || getStarterTemplates(userId);
        inMemoryTemplatesStore.set(userId, list);
        return JSON.parse(JSON.stringify(list));
    }
}

export async function getCrmTemplateById(id: string): Promise<UnifiedTemplate | null> {
    const userId = await getUserId();
    if (!id) return null;
    try {
        const { db } = await connectToDatabase();
        const template = await db.collection<UnifiedTemplate>('crm_unified_templates').findOne({
            _id: id.length === 24 ? new ObjectId(id) : id,
            userId: userId.length === 24 ? new ObjectId(userId) : userId
        });
        if (template) {
            return JSON.parse(JSON.stringify(template));
        }
    } catch (e) {
        console.warn("MongoDB query failed, falling back to local memory store:", e);
    }
    
    // In-memory fallback lookup
    const list = inMemoryTemplatesStore.get(userId) || getStarterTemplates(userId);
    const item = list.find(t => t._id?.toString() === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
}

export async function saveCrmTemplate(template: Partial<UnifiedTemplate>): Promise<{ ok: boolean; id?: string; error?: string }> {
    const userId = await getUserId();
    try {
        const { db } = await connectToDatabase();
        const templateId = template._id?.toString();
        
        const templateData: Partial<Omit<UnifiedTemplate, '_id'>> = {
            userId: userId.length === 24 ? new ObjectId(userId) : userId,
            name: template.name || 'Untitled Template',
            type: template.type || 'email',
            subject: template.subject,
            content: template.content || '',
            themeColor: template.themeColor || '#2563EB',
            fontFamily: template.fontFamily || 'Inter',
            status: template.status || 'active',
            whatsappConfig: template.whatsappConfig,
            documentConfig: template.documentConfig,
            emailConfig: template.emailConfig,
            versionHistory: template.versionHistory || [],
            updatedAt: new Date(),
        };

        if (templateId) {
            const result = await db.collection('crm_unified_templates').updateOne(
                { 
                    _id: templateId.length === 24 ? new ObjectId(templateId) : templateId, 
                    userId: userId.length === 24 ? new ObjectId(userId) : userId 
                },
                { $set: templateData }
            );
            
            revalidatePath('/dashboard/crm/templates');
            return { ok: true, id: templateId };
        } else {
            templateData.createdAt = new Date();
            const result = await db.collection('crm_unified_templates').insertOne(templateData as UnifiedTemplate);
            const newId = result.insertedId.toString();
            
            revalidatePath('/dashboard/crm/templates');
            return { ok: true, id: newId };
        }
    } catch (e) {
        console.warn("Failed to write to MongoDB, performing action on local memory store:", e);
        const list = inMemoryTemplatesStore.get(userId) || getStarterTemplates(userId);
        
        const templateId = template._id?.toString();
        let targetId = templateId;
        
        if (templateId) {
            const index = list.findIndex(t => t._id?.toString() === templateId);
            if (index !== -1) {
                list[index] = {
                    ...list[index],
                    name: template.name || list[index].name,
                    subject: template.subject ?? list[index].subject,
                    content: template.content ?? list[index].content,
                    themeColor: template.themeColor ?? list[index].themeColor,
                    fontFamily: template.fontFamily ?? list[index].fontFamily,
                    status: template.status ?? list[index].status,
                    whatsappConfig: template.whatsappConfig ?? list[index].whatsappConfig,
                    documentConfig: template.documentConfig ?? list[index].documentConfig,
                    emailConfig: template.emailConfig ?? list[index].emailConfig,
                    versionHistory: template.versionHistory ?? list[index].versionHistory,
                    updatedAt: new Date(),
                };
            }
        } else {
            targetId = Math.random().toString(36).substring(2, 15);
            const newTemplate: UnifiedTemplate = {
                _id: targetId,
                userId: userId,
                name: template.name || 'Untitled Template',
                type: template.type || 'email',
                subject: template.subject,
                content: template.content || '',
                themeColor: template.themeColor || '#2563EB',
                fontFamily: template.fontFamily || 'Inter',
                status: template.status || 'active',
                whatsappConfig: template.whatsappConfig,
                documentConfig: template.documentConfig,
                emailConfig: template.emailConfig,
                versionHistory: template.versionHistory || [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            list.push(newTemplate);
        }
        
        inMemoryTemplatesStore.set(userId, list);
        revalidatePath('/dashboard/crm/templates');
        return { ok: true, id: targetId };
    }
}

export async function deleteCrmTemplate(id: string): Promise<{ success: boolean; error?: string }> {
    const userId = await getUserId();
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_unified_templates').deleteOne({
            _id: id.length === 24 ? new ObjectId(id) : id,
            userId: userId.length === 24 ? new ObjectId(userId) : userId
        });
        
        if (result.deletedCount === 0) {
            return { success: false, error: 'Template not found' };
        }
        revalidatePath('/dashboard/crm/templates');
        return { success: true };
    } catch (e) {
        console.warn("MongoDB delete failed, deleting from local memory store:", e);
        const list = inMemoryTemplatesStore.get(userId) || getStarterTemplates(userId);
        const filtered = list.filter(t => t._id?.toString() !== id);
        inMemoryTemplatesStore.set(userId, filtered);
        revalidatePath('/dashboard/crm/templates');
        return { success: true };
    }
}

// High quality mock data compiler
export async function compileCrmTemplate(content: string, variables: Record<string, string>): Promise<string> {
    let result = content;
    const defaultVars = {
        'contact.first_name': 'Aarav',
        'contact.last_name': 'Sharma',
        'contact.email': 'aarav.sharma@example.com',
        'contact.phone': '+91 98765 43210',
        'deal.title': 'Premium Enterprise Cloud Migration Suite',
        'deal.amount': '₹18,50,000',
        'invoice.invoice_number': 'INV-2026-089',
        'invoice.total_amount': '₹21,83,000',
        'invoice.due_date': 'June 15, 2026',
        'company.name': 'SabNode Tech Private Limited',
        'company.signature': 'Vikas Patel, Director of Accounts',
    };

    const combinedVars = { ...defaultVars, ...variables };

    for (const [key, value] of Object.entries(combinedVars)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}

// Predefined variables for template studio moved to '@/data/reference/crm-template-variables' to prevent illegal object export in Server Action.

function getStarterTemplates(userId: string): UnifiedTemplate[] {
    return [
        {
            _id: 'starter-1',
            userId: userId,
            name: 'Vibrant Welcome & Onboarding Email',
            type: 'email',
            subject: 'Welcome to {{company.name}}! Let\'s get you set up.',
            content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #0F172A; color: #E2E8F0; padding: 20px; }
    .card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 600px; margin: 0 auto; }
    .header { font-size: 24px; font-weight: bold; background: linear-gradient(to right, #3B82F6, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 16px; }
    .button { display: inline-block; background: linear-gradient(135deg, #2563EB, #4F46E5); color: #FFFFFF; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4); }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155; font-size: 12px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">Hello {{contact.first_name}}, Welcome Aboard!</div>
    <p>We are absolutely thrilled to welcome you to the family. Your account is ready and fully configured.</p>
    <p>Our team at <strong>{{company.name}}</strong> is committed to ensuring you get the absolute best results. Here is your onboarding portal link:</p>
    <div style="text-align: center;">
      <a href="https://sabnode.com/onboard?email={{contact.email}}" class="button">Access Onboarding Console</a>
    </div>
    <p>If you have any questions or need anything at all, feel free to reply directly to this email.</p>
    <div class="footer">
      Best regards,<br>
      <strong>{{company.signature}}</strong>
    </div>
  </div>
</body>
</html>`,
            themeColor: '#4F46E5',
            fontFamily: 'Inter',
            status: 'active',
            emailConfig: {
                blocks: [
                    { id: 'b1', type: 'header', content: { title: 'Welcome Aboard!' } },
                    { id: 'b2', type: 'text', content: { html: 'We are absolutely thrilled to welcome you to the family. Your account is ready and fully configured.' } },
                    { id: 'b3', type: 'button', content: { text: 'Access Onboarding Console', url: 'https://sabnode.com/onboard' } },
                    { id: 'b4', type: 'footer', content: { signature: '{{company.signature}}' } }
                ]
            },
            versionHistory: [
                { versionId: 'v1-1', timestamp: new Date(Date.now() - 3600000 * 2), content: 'Initial template layout setup.', description: 'Base creation' }
            ],
            createdAt: new Date(Date.now() - 3600000 * 24),
            updatedAt: new Date(),
        },
        {
            _id: 'starter-2',
            userId: userId,
            name: 'Deal Closed Success - WhatsApp Notification',
            type: 'whatsapp',
            content: '🎉 *Deal Successfully Won!* 🎉\n\nHi {{contact.first_name}},\n\nExcellent news! We have successfully sealed the *{{deal.title}}* deal at *{{deal.amount}}*.\n\nThank you for choosing {{company.name}}! Click below to view terms.',
            themeColor: '#10B981',
            status: 'active',
            whatsappConfig: {
                headerType: 'text',
                headerText: 'DEAL CONFIRMATION',
                footerText: 'SabNode CRM Notification Service',
                buttons: [
                    { type: 'quick_reply', text: 'Accept Quote' },
                    { type: 'url', text: 'View Dashboard', value: 'https://sabnode.com/deals' }
                ]
            },
            versionHistory: [
                { versionId: 'v2-1', timestamp: new Date(Date.now() - 3600000), content: 'Basic message text format.', description: 'Base draft' }
            ],
            createdAt: new Date(Date.now() - 3600000 * 5),
            updatedAt: new Date(),
        },
        {
            _id: 'starter-3',
            userId: userId,
            name: 'Payment Due Warning SMS',
            type: 'sms',
            content: 'Alert: Payment of {{invoice.total_amount}} for Invoice {{invoice.invoice_number}} of {{company.name}} is due on {{invoice.due_date}}. Please pay immediately to avoid late fees. Support call: {{contact.phone}}',
            themeColor: '#EF4444',
            status: 'active',
            versionHistory: [],
            createdAt: new Date(Date.now() - 3600000 * 12),
            updatedAt: new Date(),
        },
        {
            _id: 'starter-4',
            userId: userId,
            name: 'Modern Executive Quotation PDF',
            type: 'document',
            subject: 'Quotation for {{deal.title}}',
            content: JSON.stringify({
                companyName: '{{company.name}}',
                recipientName: '{{contact.first_name}} {{contact.last_name}}',
                quoteNumber: 'QT-2026-908',
                amount: '{{deal.amount}}',
                items: [
                    { desc: 'Cloud migration architect planning & setup', rate: '₹3,50,000', qty: '1' },
                    { desc: 'Core server deployment & Node clusters configuration', rate: '₹9,00,000', qty: '1' },
                    { desc: 'Enterprise SabNode CRM integration keys & licenses', rate: '₹6,00,000', qty: '1' }
                ],
                terms: 'Payment is due within 15 days from delivery of quotation document.'
            }),
            themeColor: '#0F172A',
            fontFamily: 'Outfit',
            status: 'active',
            documentConfig: {
                margins: 'normal',
                showSignature: true,
                showItemsTable: true,
                footerTerms: 'Strictly confidential document of SabNode.'
            },
            createdAt: new Date(Date.now() - 3600000 * 48),
            updatedAt: new Date(),
        }
    ];
}
