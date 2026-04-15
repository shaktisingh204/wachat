'use server';

export async function executeTallyFormsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://api.tally.so';

        switch (actionName) {
            case 'listForms': {
                const res = await fetch(`${baseUrl}/forms`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { forms: data } };
            }
            case 'getForm': {
                const formId = String(inputs.formId ?? '').trim();
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { form: data } };
            }
            case 'createForm': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.workspaceId) body.workspaceId = inputs.workspaceId;
                if (inputs.status) body.status = inputs.status;
                const res = await fetch(`${baseUrl}/forms`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { form: data } };
            }
            case 'updateForm': {
                const formId = String(inputs.formId ?? '').trim();
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.status) body.status = inputs.status;
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { form: data } };
            }
            case 'deleteForm': {
                const formId = String(inputs.formId ?? '').trim();
                const res = await fetch(`${baseUrl}/forms/${formId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, formId } };
            }
            case 'listSubmissions': {
                const formId = String(inputs.formId ?? '').trim();
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/forms/${formId}/submissions${query}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { submissions: data } };
            }
            case 'getSubmission': {
                const formId = String(inputs.formId ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                const res = await fetch(`${baseUrl}/forms/${formId}/submissions/${submissionId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { submission: data } };
            }
            case 'deleteSubmission': {
                const formId = String(inputs.formId ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                const res = await fetch(`${baseUrl}/forms/${formId}/submissions/${submissionId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, submissionId } };
            }
            case 'listWorkspaces': {
                const res = await fetch(`${baseUrl}/workspaces`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { workspaces: data } };
            }
            case 'getWorkspace': {
                const workspaceId = String(inputs.workspaceId ?? '').trim();
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { workspace: data } };
            }
            case 'createWorkspace': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.slug) body.slug = inputs.slug;
                const res = await fetch(`${baseUrl}/workspaces`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { workspace: data } };
            }
            case 'updateWorkspace': {
                const workspaceId = String(inputs.workspaceId ?? '').trim();
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.slug) body.slug = inputs.slug;
                const res = await fetch(`${baseUrl}/workspaces/${workspaceId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { workspace: data } };
            }
            case 'listFields': {
                const formId = String(inputs.formId ?? '').trim();
                const res = await fetch(`${baseUrl}/forms/${formId}/fields`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { fields: data } };
            }
            case 'addField': {
                const formId = String(inputs.formId ?? '').trim();
                const body: any = {};
                if (inputs.type) body.type = inputs.type;
                if (inputs.label) body.label = inputs.label;
                if (inputs.required !== undefined) body.required = inputs.required;
                if (inputs.position !== undefined) body.position = inputs.position;
                const res = await fetch(`${baseUrl}/forms/${formId}/fields`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { field: data } };
            }
            case 'updateField': {
                const formId = String(inputs.formId ?? '').trim();
                const fieldId = String(inputs.fieldId ?? '').trim();
                const body: any = {};
                if (inputs.label) body.label = inputs.label;
                if (inputs.required !== undefined) body.required = inputs.required;
                if (inputs.position !== undefined) body.position = inputs.position;
                const res = await fetch(`${baseUrl}/forms/${formId}/fields/${fieldId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { field: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
