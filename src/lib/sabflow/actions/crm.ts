

'use server';

import { addCrmLeadAndDeal } from '@/app/actions/crm-deals.actions';
import { addCrmNote } from '@/app/actions/crm.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeCrmAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const formData = new FormData();
        Object.keys(inputs).forEach(key => {
             if (inputs[key] !== undefined && inputs[key] !== null) {
                formData.append(key, String(inputs[key]));
            }
        });
        
        switch (actionName) {
            case 'createLead': {
                const result = await addCrmLeadAndDeal(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            case 'addNote': {
                if (!inputs.recordId || !inputs.recordType || !inputs.noteContent) {
                    throw new Error("Record ID, Record Type, and Note Content are required.");
                }
                const result = await addCrmNote(null, formData);
                 if (result.error) throw new Error(result.error);
                return { output: result };
            }
            default:
                throw new Error(`CRM action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}
