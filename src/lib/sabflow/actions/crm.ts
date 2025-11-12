

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


export const crmActions = [
    {
        name: 'createLead',
        label: 'Create Lead & Deal',
        description: 'Creates a new lead and an associated deal in the sales pipeline.',
        inputs: [
            { name: 'contactName', label: 'Contact Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phone', label: 'Phone', type: 'tel' },
            { name: 'company', label: 'Company Name', type: 'text' },
            { name: 'dealName', label: 'Deal Name / Subject', type: 'text', required: true },
            { name: 'dealValue', label: 'Deal Value', type: 'number', required: true },
            { name: 'dealStage', label: 'Initial Deal Stage', type: 'text', placeholder: 'e.g., New' },
        ]
    },
    {
        name: 'addNote',
        label: 'Add Note to Record',
        description: 'Adds a note to a contact, account, or deal.',
        inputs: [
            { name: 'recordId', label: 'Record ID', type: 'text', required: true, placeholder: 'e.g., {{trigger.contactId}}' },
            { name: 'recordType', label: 'Record Type', type: 'select', options: ['contact', 'account', 'deal'], required: true },
            { name: 'noteContent', label: 'Note Content', type: 'textarea', required: true },
        ]
    }
];
