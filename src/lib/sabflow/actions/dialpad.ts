'use server';

export async function executeDialpadAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { apiKey } = inputs;
        const baseUrl = 'https://dialpad.com/api/v2';

        const headers: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        async function dialpadFetch(method: string, path: string, body?: any) {
            logger?.log(`[Dialpad] ${method} ${path}`);
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${baseUrl}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.message || data?.error || `Dialpad API error: ${res.status}`);
            }
            return data;
        }

        switch (actionName) {
            case 'listCalls': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.started_after) params.set('started_after', inputs.started_after);
                if (inputs.started_before) params.set('started_before', inputs.started_before);
                const data = await dialpadFetch('GET', `/call?${params.toString()}`);
                return { output: data };
            }

            case 'getCall': {
                const data = await dialpadFetch('GET', `/call/${inputs.callId}`);
                return { output: data };
            }

            case 'makeCall': {
                const body: any = {
                    phone_number: inputs.phoneNumber,
                    user_id: inputs.userId,
                };
                if (inputs.outbound_caller_id) body.outbound_caller_id = inputs.outbound_caller_id;
                if (inputs.custom_data) body.custom_data = inputs.custom_data;
                const data = await dialpadFetch('POST', '/call', body);
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.search) params.set('search', inputs.search);
                const data = await dialpadFetch('GET', `/contact?${params.toString()}`);
                return { output: data };
            }

            case 'getContact': {
                const data = await dialpadFetch('GET', `/contact/${inputs.contactId}`);
                return { output: data };
            }

            case 'createContact': {
                const body: any = {};
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.emails) body.emails = inputs.emails;
                if (inputs.phones) body.phones = inputs.phones;
                if (inputs.company_name) body.company_name = inputs.company_name;
                if (inputs.job_title) body.job_title = inputs.job_title;
                const data = await dialpadFetch('POST', '/contact', body);
                return { output: data };
            }

            case 'updateContact': {
                const body: any = {};
                if (inputs.firstName) body.first_name = inputs.firstName;
                if (inputs.lastName) body.last_name = inputs.lastName;
                if (inputs.emails) body.emails = inputs.emails;
                if (inputs.phones) body.phones = inputs.phones;
                if (inputs.company_name) body.company_name = inputs.company_name;
                if (inputs.job_title) body.job_title = inputs.job_title;
                const data = await dialpadFetch('PATCH', `/contact/${inputs.contactId}`, body);
                return { output: data };
            }

            case 'deleteContact': {
                await dialpadFetch('DELETE', `/contact/${inputs.contactId}`);
                return { output: { success: true, contactId: inputs.contactId } };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.state) params.set('state', inputs.state);
                const data = await dialpadFetch('GET', `/user?${params.toString()}`);
                return { output: data };
            }

            case 'getUser': {
                const data = await dialpadFetch('GET', `/user/${inputs.userId}`);
                return { output: data };
            }

            case 'listOffices': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const data = await dialpadFetch('GET', `/office?${params.toString()}`);
                return { output: data };
            }

            case 'getOffice': {
                const data = await dialpadFetch('GET', `/office/${inputs.officeId}`);
                return { output: data };
            }

            case 'listDepartments': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const data = await dialpadFetch('GET', `/department?${params.toString()}`);
                return { output: data };
            }

            case 'getDepartment': {
                const data = await dialpadFetch('GET', `/department/${inputs.departmentId}`);
                return { output: data };
            }

            case 'sendSMS': {
                const body: any = {
                    to_numbers: inputs.toNumbers,
                    text: inputs.text,
                };
                if (inputs.from_number) body.from_number = inputs.from_number;
                if (inputs.user_id) body.user_id = inputs.user_id;
                const data = await dialpadFetch('POST', '/sms', body);
                return { output: data };
            }

            default:
                return { error: `Dialpad action "${actionName}" is not implemented.` };
        }
    } catch (error: any) {
        logger?.log(`[Dialpad] Error: ${error.message}`);
        return { error: error.message || 'An unknown error occurred in Dialpad action.' };
    }
}
