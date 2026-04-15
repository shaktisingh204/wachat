'use server';

export async function executeJotFormEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const { apiKey, formId, submissionId, questionId, reportId, ...rest } = inputs;
    const baseUrl = 'https://api.jotform.com';

    const buildUrl = (path: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams({ apiKey, ...extra });
        return `${baseUrl}${path}?${params}`;
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    const jsonHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listForms': {
                const extra: Record<string, string> = {};
                if (rest.offset) extra.offset = String(rest.offset);
                if (rest.limit) extra.limit = String(rest.limit);
                if (rest.filter) extra.filter = JSON.stringify(rest.filter);
                const res = await fetch(buildUrl('/user/forms', extra));
                if (!res.ok) return { error: `JotForm listForms error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getForm': {
                const res = await fetch(buildUrl(`/form/${formId}`));
                if (!res.ok) return { error: `JotForm getForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createForm': {
                const body = new URLSearchParams();
                body.set('apiKey', apiKey);
                if (rest.questions) body.set('questions', JSON.stringify(rest.questions));
                if (rest.properties) body.set('properties', JSON.stringify(rest.properties));
                const res = await fetch(`${baseUrl}/form`, { method: 'POST', headers, body: body.toString() });
                if (!res.ok) return { error: `JotForm createForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateForm': {
                const body = new URLSearchParams();
                body.set('apiKey', apiKey);
                if (rest.properties) body.set('properties', JSON.stringify(rest.properties));
                const res = await fetch(`${baseUrl}/form/${formId}/properties`, { method: 'PUT', headers, body: body.toString() });
                if (!res.ok) return { error: `JotForm updateForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteForm': {
                const res = await fetch(buildUrl(`/form/${formId}`), { method: 'DELETE' });
                if (!res.ok) return { error: `JotForm deleteForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listFormSubmissions': {
                const extra: Record<string, string> = {};
                if (rest.offset) extra.offset = String(rest.offset);
                if (rest.limit) extra.limit = String(rest.limit);
                if (rest.filter) extra.filter = JSON.stringify(rest.filter);
                if (rest.orderby) extra.orderby = rest.orderby;
                const res = await fetch(buildUrl(`/form/${formId}/submissions`, extra));
                if (!res.ok) return { error: `JotForm listFormSubmissions error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getSubmission': {
                const res = await fetch(buildUrl(`/submission/${submissionId}`));
                if (!res.ok) return { error: `JotForm getSubmission error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFormQuestions': {
                const res = await fetch(buildUrl(`/form/${formId}/questions`));
                if (!res.ok) return { error: `JotForm getFormQuestions error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'addFormQuestion': {
                const body = new URLSearchParams();
                body.set('apiKey', apiKey);
                if (rest.question) body.set('question', JSON.stringify(rest.question));
                const res = await fetch(`${baseUrl}/form/${formId}/questions`, { method: 'POST', headers, body: body.toString() });
                if (!res.ok) return { error: `JotForm addFormQuestion error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getUser': {
                const res = await fetch(buildUrl('/user'));
                if (!res.ok) return { error: `JotForm getUser error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getUserForms': {
                const extra: Record<string, string> = {};
                if (rest.offset) extra.offset = String(rest.offset);
                if (rest.limit) extra.limit = String(rest.limit);
                const res = await fetch(buildUrl('/user/forms', extra));
                if (!res.ok) return { error: `JotForm getUserForms error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listReports': {
                const res = await fetch(buildUrl(`/form/${formId}/reports`));
                if (!res.ok) return { error: `JotForm listReports error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createReport': {
                const body = new URLSearchParams();
                body.set('apiKey', apiKey);
                body.set('title', rest.title || 'Report');
                body.set('list_type', rest.listType || 'excel');
                if (rest.fields) body.set('fields', JSON.stringify(rest.fields));
                const res = await fetch(`${baseUrl}/form/${formId}/reports`, { method: 'POST', headers, body: body.toString() });
                if (!res.ok) return { error: `JotForm createReport error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteReport': {
                const res = await fetch(buildUrl(`/report/${reportId}`), { method: 'DELETE' });
                if (!res.ok) return { error: `JotForm deleteReport error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFormFiles': {
                const extra: Record<string, string> = {};
                if (rest.offset) extra.offset = String(rest.offset);
                if (rest.limit) extra.limit = String(rest.limit);
                const res = await fetch(buildUrl(`/form/${formId}/files`, extra));
                if (!res.ok) return { error: `JotForm getFormFiles error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `JotForm Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
