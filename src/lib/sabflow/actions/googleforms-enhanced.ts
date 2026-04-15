'use server';

export async function executeGoogleFormsEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, formId, responseId, watchId, ...rest } = inputs;
    const baseUrl = 'https://forms.googleapis.com/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createForm': {
                const body: Record<string, any> = {
                    info: {
                        title: rest.title,
                        documentTitle: rest.documentTitle || rest.title,
                    },
                };
                const res = await fetch(`${baseUrl}/forms`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Google Forms createForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getForm': {
                const res = await fetch(`${baseUrl}/forms/${formId}`, { headers });
                if (!res.ok) return { error: `Google Forms getForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateForm': {
                const body: Record<string, any> = {
                    requests: rest.requests || [],
                    includeFormInResponse: rest.includeFormInResponse !== undefined ? rest.includeFormInResponse : true,
                };
                const res = await fetch(`${baseUrl}/forms/${formId}:batchUpdate`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Google Forms updateForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteForm': {
                // Google Forms API doesn't have a native delete endpoint; this performs a Drive delete
                const driveUrl = `https://www.googleapis.com/drive/v3/files/${formId}`;
                const res = await fetch(driveUrl, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, formId } };
                if (!res.ok) return { error: `Google Forms deleteForm error: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, formId } };
            }

            case 'listResponses': {
                const params = new URLSearchParams();
                if (rest.pageSize) params.set('pageSize', String(rest.pageSize));
                if (rest.pageToken) params.set('pageToken', rest.pageToken);
                if (rest.filter) params.set('filter', rest.filter);
                const res = await fetch(`${baseUrl}/forms/${formId}/responses?${params}`, { headers });
                if (!res.ok) return { error: `Google Forms listResponses error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getResponse': {
                const res = await fetch(`${baseUrl}/forms/${formId}/responses/${responseId}`, { headers });
                if (!res.ok) return { error: `Google Forms getResponse error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFormResponseCount': {
                const params = new URLSearchParams({ pageSize: '1' });
                const res = await fetch(`${baseUrl}/forms/${formId}/responses?${params}`, { headers });
                if (!res.ok) return { error: `Google Forms getFormResponseCount error: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { totalResponses: data.totalSize ?? (data.responses?.length ?? 0) } };
            }

            case 'createWatch': {
                const body: Record<string, any> = {
                    watch: {
                        target: {
                            topic: {
                                topicName: rest.topicName,
                            },
                        },
                        eventType: rest.eventType || 'RESPONSES',
                    },
                };
                const res = await fetch(`${baseUrl}/forms/${formId}/watches`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Google Forms createWatch error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteWatch': {
                const res = await fetch(`${baseUrl}/forms/${formId}/watches/${watchId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { deleted: true, watchId } };
                if (!res.ok) return { error: `Google Forms deleteWatch error: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, watchId } };
            }

            case 'listWatches': {
                const res = await fetch(`${baseUrl}/forms/${formId}/watches`, { headers });
                if (!res.ok) return { error: `Google Forms listWatches error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'batchUpdateForm': {
                const body: Record<string, any> = {
                    requests: rest.requests || [],
                    includeFormInResponse: rest.includeFormInResponse !== undefined ? rest.includeFormInResponse : true,
                };
                const res = await fetch(`${baseUrl}/forms/${formId}:batchUpdate`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Google Forms batchUpdateForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'setPublishSettings': {
                const body: Record<string, any> = {
                    publishSettings: rest.publishSettings || {},
                };
                const res = await fetch(`${baseUrl}/forms/${formId}:setPublishSettings`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Google Forms setPublishSettings error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPublishSettings': {
                const res = await fetch(`${baseUrl}/forms/${formId}`, { headers });
                if (!res.ok) return { error: `Google Forms getPublishSettings error: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { publishSettings: data.publishSettings ?? null, responderUri: data.responderUri } };
            }

            case 'createFormWithQuestions': {
                // Step 1: create the form
                const createBody: Record<string, any> = {
                    info: {
                        title: rest.title,
                        documentTitle: rest.documentTitle || rest.title,
                    },
                };
                const createRes = await fetch(`${baseUrl}/forms`, { method: 'POST', headers, body: JSON.stringify(createBody) });
                if (!createRes.ok) return { error: `Google Forms createFormWithQuestions (create) error: ${createRes.status} ${await createRes.text()}` };
                const createdForm = await createRes.json();
                const newFormId = createdForm.formId;

                // Step 2: batch update with questions if provided
                if (rest.questions && Array.isArray(rest.questions) && rest.questions.length > 0) {
                    const requests = rest.questions.map((q: any, index: number) => ({
                        createItem: {
                            item: {
                                title: q.title,
                                questionItem: { question: q.question },
                            },
                            location: { index },
                        },
                    }));
                    const updateRes = await fetch(`${baseUrl}/forms/${newFormId}:batchUpdate`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ requests, includeFormInResponse: true }),
                    });
                    if (!updateRes.ok) return { error: `Google Forms createFormWithQuestions (update) error: ${updateRes.status} ${await updateRes.text()}` };
                    return { output: await updateRes.json() };
                }

                return { output: createdForm };
            }

            case 'cloneForm': {
                // Clone via Drive copy API
                const driveUrl = `https://www.googleapis.com/drive/v3/files/${formId}/copy`;
                const body: Record<string, any> = {};
                if (rest.title) body.name = rest.title;
                const res = await fetch(driveUrl, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Google Forms cloneForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Google Forms Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
