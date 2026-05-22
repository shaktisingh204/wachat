'use server';

import { getSession } from '@/app/actions/user.actions';
import { addCrmAccount } from '@/app/actions/crm-accounts.actions';
import { addCrmContact } from '@/app/actions/crm.actions';
import { saveCrmVendor } from '@/app/actions/crm-vendors.actions';
import { saveCrmProduct } from '@/app/actions/crm-products.actions';
import type { LookupItem, EntityKey } from '@/lib/lookup-registry';

/**
 * Universal Quick Create actions for inline entity creation from <EntityPicker>.
 * Delegates to the existing server actions but extracts the created entity
 * and maps it to a standard `LookupItem` shape so the picker can auto-select it.
 */
export async function quickCreateEntity(
    entity: EntityKey,
    formData: FormData
): Promise<{ success: boolean; error?: string; item?: LookupItem }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    try {
        switch (entity) {
            case 'client': {
                const res = await addCrmAccount({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.newClient._id),
                        chip: { primary: res.newClient.name },
                        raw: res.newClient,
                    },
                };
            }
            case 'contact': {
                const res = await addCrmContact({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.newContact._id),
                        chip: { primary: res.newContact.name },
                        raw: res.newContact,
                    },
                };
            }
            case 'vendor': {
                const res = await saveCrmVendor({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.newVendor._id),
                        chip: { primary: res.newVendor.name },
                        raw: res.newVendor,
                    },
                };
            }
            case 'item': {
                const res = await saveCrmProduct({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.newProduct._id),
                        chip: { primary: res.newProduct.name, secondary: res.newProduct.sku },
                        raw: res.newProduct,
                    },
                };
            }
            case 'lead': {
                const res = await addCrmLead({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.leadId),
                        chip: { primary: formData.get('title') as string, secondary: formData.get('contactName') as string },
                        raw: { id: res.leadId, title: formData.get('title'), contactName: formData.get('contactName') },
                    },
                };
            }
            case 'employee': {
                const res = await addCrmEmployee({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.employeeId),
                        chip: { primary: formData.get('name') as string, secondary: formData.get('email') as string },
                        raw: { id: res.employeeId, name: formData.get('name') },
                    },
                };
            }
            case 'project': {
                const res = await addCrmProject({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.projectId),
                        chip: { primary: formData.get('name') as string },
                        raw: { id: res.projectId, name: formData.get('name') },
                    },
                };
            }
            case 'task': {
                const res = await addCrmTask({}, formData);
                if (res.error) return { success: false, error: res.error };
                return {
                    success: true,
                    item: {
                        id: String(res.taskId),
                        chip: { primary: formData.get('title') as string },
                        raw: { id: res.taskId, title: formData.get('title') },
                    },
                };
            }
            default:
                return { success: false, error: `Quick create not supported for ${entity}.` };
        }
    } catch (err: any) {
        return { success: false, error: err.message || 'Quick create failed.' };
    }
}
