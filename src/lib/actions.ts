

'use server';

import { cookies } from 'next/headers';
import { getDecodedSession, verifyAdminJwt } from './auth';
import type { User, Project, Plan, Tag } from './definitions';
import { connectToDatabase } from './mongodb';
import { ObjectId, WithId } from 'mongodb';


export * from './actions/user.actions';
export * from './actions/project.actions';
export * from './actions/whatsapp.actions';
export * from './actions/broadcast.actions';
export * from './actions/webhook.actions';
export * from './actions/billing.actions';
export * from './actions/contact.actions';
export * from './actions/api-keys.actions';
export * from './actions/url-shortener.actions';
export * from './actions/qr-code.actions';
export * from './actions/integrations.actions';
export * from './actions/widget.actions';
export * from './actions/flow.actions';
export * from './actions/meta-flow.actions';
export * from './actions/facebook.actions';
export * from './actions/instagram.actions';
export * from './actions/custom-ecommerce.actions';
export * from './actions/portfolio.actions';
export * from './actions/crm.actions';
export * from './actions/crm-roles.actions';
export * from './actions/crm-accounts.actions';
export * from './actions/crm-deals.actions';
export * from './actions/crm-tasks.actions';
export * from './actions/crm-email.actions';
export * from './actions/crm-email-templates.actions';
export * from './actions/crm-automations.actions';
export * from './actions/crm-reports.actions';
export * from './actions/crm-products.actions';
export * from './actions/crm-warehouses.actions';
export * from './actions/crm-inventory.actions';
export * from './actions/crm-vendors.actions';
export * from './actions/crm-quotations.actions';
export * from './actions/crm-invoices.actions';
export * from './actions/crm-payment-receipts.actions';
export * from './actions/crm-sales-orders.actions';
export * from './actions/crm-delivery-challans.actions';
export * from './actions/crm-credit-notes.actions';
export * from './actions/crm-forms.actions';
export * from './actions/crm-accounting.actions';
export * from './actions/crm-vouchers.actions';
export * from './actions/crm-pipelines.actions';
export * from './actions/crm-payment-accounts.actions';
export * from './actions/crm-reconciliation.actions';
export * from './actions/email.actions';
export * from './actions/sms.actions';
export * from './actions/seo.actions';
export * from './actions/template.actions';
export * from './actions/send-template.actions';
export * from './actions/calling.actions';
export * from './actions/catalog.actions';
export * from './actions/facebook-flow.actions';
export * from './actions/plan.actions';
export * from './actions/notification.actions';
export * from './actions/ai-actions';
export * from './actions/admin.actions';
export * from './actions/sabchat.actions';
export * from './actions/team.actions';
export * from './actions/crm-employees.actions';
export * from './actions/crm-hr.actions';
export * from './actions/crm-payroll.actions';
export * from './actions/crm-hr-reports.actions';
export * from './actions/crm-hr-appraisals.actions';
export * from './actions/sabflow.actions';
export * from './actions/crm-leads.actions';
export * from './actions/crm-leads-api.actions';
export * from './actions/meta-suite.actions';


export async function getSession(): Promise<{ user: Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null, tags?: Tag[] } } | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
    const sessionToken = sessionCookie?.value;

    if (!sessionToken) {
        return null;
    }

    const decoded = await getDecodedSession(sessionToken);
    if (!decoded) return null;

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ email: decoded.email }, { projection: { password: 0 } });
        if (!user) return null;
        
        let plan: WithId<Plan> | null = null;
        if (user.planId && ObjectId.isValid(user.planId)) {
            plan = await db.collection<WithId<Plan>>('plans').findOne({ _id: new ObjectId(user.planId) });
        }
        if (!plan) {
            plan = await db.collection<WithId<Plan>>('plans').findOne({ isDefault: true });
        }
        
        const mergedUser = {
            ...user,
            _id: user._id.toString(),
            name: user.name || decoded.name,
            image: user.image || decoded.picture,
            plan: plan ? JSON.parse(JSON.stringify(plan)) : null,
        };

        return { user: mergedUser as any };
    } catch (e) {
        console.error("Failed to fetch user from DB in getSession:", e);
        return null;
    }
}


export async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session')?.value;
  if (!sessionCookie) return { isAdmin: false };
  
  const decoded = await verifyAdminJwt(sessionCookie);
  if (!decoded) return { isAdmin: false };

  return { isAdmin: true, user: decoded };
}


