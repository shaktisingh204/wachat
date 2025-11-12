
'use server';

import { sendCrmEmail } from '@/app/actions/crm-email.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeEmailAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const formData = new FormData();
        Object.keys(inputs).forEach(key => {
             if (inputs[key] !== undefined && inputs[key] !== null) {
                formData.append(key, String(inputs[key]));
            }
        });

        switch (actionName) {
            case 'sendEmail': {
                const result = await sendCrmEmail(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            default:
                throw new Error(`Email action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}

export const emailActions = [
    {
        name: 'sendEmail',
        label: 'Send Email',
        description: 'Sends an email using your configured SMTP or OAuth provider.',
        inputs: [
            { name: 'to', label: 'To', type: 'email', required: true },
            { name: 'subject', label: 'Subject', type: 'text', required: true },
            { name: 'body', label: 'Body (HTML)', type: 'textarea', required: true },
        ]
    }
];
