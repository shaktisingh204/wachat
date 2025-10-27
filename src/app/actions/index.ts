

// This file is intentionally left blank.
// Server actions are co-located in their respective feature files (e.g., src/app/actions/project.actions.ts).
// This file can be used for global actions if needed in the future.

// For backwards compatibility, re-exporting from the new locations
export * from './user.actions';
export * from './project.actions';
export * from './whatsapp.actions';
export * from './broadcast.actions';
export * from './webhook.actions';
export * from './billing.actions';
export * from './contact.actions';
export * from './api-keys.actions';
export * from './url-shortener.actions';
export * from './qr-code.actions';
export * from './integrations.actions';
export * from './flow.actions';
export * from './meta-flow.actions';
export * from './facebook.actions';
export * from './instagram.actions';
export * from './custom-ecommerce.actions';
export * from './portfolio.actions';
export * from './crm.actions';
export * from './crm-accounts.actions';
export * from './crm-deals.actions';
export * from './crm-tasks.actions';
export * from './crm-email.actions';
export * from './crm-email-templates.actions';
export * from './crm-automations.actions';
export * from './crm-reports.actions';
export * from './crm-products.actions';
export * from './crm-warehouses.actions';
export * from './crm-inventory.actions';
export * from './crm-vendors.actions';
export * from './crm-quotations.actions';
export * from './crm-invoices.actions';
export * from './crm-payment-receipts.actions';
export * from './crm-sales-orders.actions';
export * from './crm-delivery-challans.actions';
export * from './crm-credit-notes.actions';
export * from './crm-forms.actions';
export * from './crm-accounting.actions';
export * from './crm-vouchers.actions';
export * from './crm-pipelines.actions';
export * from './email.actions';
export * from './sms.actions';
export * from './seo.actions';
export * from './template.actions';
export * from './calling.actions';
export * from './catalog.actions';
export * from './facebook-flow.actions';
export * from './plan.actions';
export * from './notification.actions';
export * from './ai-actions';

// This needs to be a server action file, so we export a dummy function
export async function dummyAction() {
    'use server';
    // This function does nothing.
}

    