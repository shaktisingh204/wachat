'use server';

import {
    getLeadGenConfig,
    saveLeadGenConfig,
    deleteLeadGenForm,
    getLeadGenConfigForms,
    getLeadGenActivity,
} from '@/lib/rust-client/wachat-facebook-leadgen-config';
import type { LeadGenConfig } from '@/lib/rust-client/wachat-facebook-leadgen-config';

export { getLeadGenConfig, getLeadGenConfigForms, getLeadGenActivity };

export async function saveLeadGenConfigAction(config: Partial<LeadGenConfig>) {
    return saveLeadGenConfig(config);
}

export async function deleteLeadGenFormAction(formId: string) {
    return deleteLeadGenForm(formId);
}
