'use server';

export async function executeDocusealAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.docuseal.com/v1';
    const apiKey = inputs.apiKey;

    if (!apiKey) {
        return { error: 'Missing required credential: apiKey' };
    }

    const headers: Record<string, string> = {
        'X-Auth-Token': apiKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listForms': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.after) params.set('after', String(inputs.after));
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listForms failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getForm': {
                if (!inputs.formId) return { error: 'Missing required field: formId' };
                const res = await fetch(`${baseUrl}/templates/${inputs.formId}`, { headers });
                if (!res.ok) return { error: `getForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createForm': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.documents) body.documents = inputs.documents;
                if (inputs.submitters) body.submitters = inputs.submitters;
                const res = await fetch(`${baseUrl}/templates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'archiveForm': {
                if (!inputs.formId) return { error: 'Missing required field: formId' };
                const res = await fetch(`${baseUrl}/templates/${inputs.formId}/archive`, {
                    method: 'PUT',
                    headers,
                });
                if (!res.ok) return { error: `archiveForm failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listSubmissions': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.after) params.set('after', String(inputs.after));
                if (inputs.template_id) params.set('template_id', String(inputs.template_id));
                const res = await fetch(`${baseUrl}/submissions?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listSubmissions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getSubmission': {
                if (!inputs.submissionId) return { error: 'Missing required field: submissionId' };
                const res = await fetch(`${baseUrl}/submissions/${inputs.submissionId}`, { headers });
                if (!res.ok) return { error: `getSubmission failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createSubmission': {
                if (!inputs.template_id) return { error: 'Missing required field: template_id' };
                const body: any = { template_id: inputs.template_id };
                if (inputs.submitters) body.submitters = inputs.submitters;
                if (inputs.send_email !== undefined) body.send_email = inputs.send_email;
                if (inputs.send_sms !== undefined) body.send_sms = inputs.send_sms;
                if (inputs.message) body.message = inputs.message;
                const res = await fetch(`${baseUrl}/submissions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createSubmission failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'archiveSubmission': {
                if (!inputs.submissionId) return { error: 'Missing required field: submissionId' };
                const res = await fetch(`${baseUrl}/submissions/${inputs.submissionId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `archiveSubmission failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listSubmitters': {
                const params = new URLSearchParams();
                if (inputs.submission_id) params.set('submission_id', String(inputs.submission_id));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.after) params.set('after', String(inputs.after));
                const res = await fetch(`${baseUrl}/submitters?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listSubmitters failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getSubmitter': {
                if (!inputs.submitterId) return { error: 'Missing required field: submitterId' };
                const res = await fetch(`${baseUrl}/submitters/${inputs.submitterId}`, { headers });
                if (!res.ok) return { error: `getSubmitter failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateSubmitter': {
                if (!inputs.submitterId) return { error: 'Missing required field: submitterId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.fields) body.fields = inputs.fields;
                if (inputs.values) body.values = inputs.values;
                if (inputs.completed !== undefined) body.completed = inputs.completed;
                const res = await fetch(`${baseUrl}/submitters/${inputs.submitterId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateSubmitter failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.after) params.set('after', String(inputs.after));
                if (inputs.q) params.set('q', String(inputs.q));
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { headers });
                if (!res.ok) return { error: `listTemplates failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTemplate': {
                if (!inputs.templateId) return { error: 'Missing required field: templateId' };
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}`, { headers });
                if (!res.ok) return { error: `getTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createTemplate': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.documents) body.documents = inputs.documents;
                if (inputs.submitters) body.submitters = inputs.submitters;
                if (inputs.fields) body.fields = inputs.fields;
                const res = await fetch(`${baseUrl}/templates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deleteTemplate': {
                if (!inputs.templateId) return { error: 'Missing required field: templateId' };
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deleteTemplate failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                logger.log(`Error: Docuseal action "${actionName}" is not implemented.`);
                return { error: `Docuseal action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        const message = err?.message || String(err);
        logger.log(`Docuseal action error: ${message}`);
        return { error: message };
    }
}
