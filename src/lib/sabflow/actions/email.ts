
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
