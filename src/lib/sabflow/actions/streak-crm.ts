'use server';

export async function executeStreakCRMAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://www.streak.com/api/v1';
    const authHeader = `Basic ${Buffer.from(inputs.apiKey + ':').toString('base64')}`;
    const headers = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listPipelines': {
                const res = await fetch(`${baseUrl}/pipelines`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list pipelines' };
                return { output: data };
            }

            case 'getPipeline': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get pipeline' };
                return { output: data };
            }

            case 'createPipeline': {
                const res = await fetch(`${baseUrl}/pipelines`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        orgWide: inputs.orgWide,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create pipeline' };
                return { output: data };
            }

            case 'listBoxes': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/boxes`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list boxes' };
                return { output: data };
            }

            case 'getBox': {
                const res = await fetch(`${baseUrl}/boxes/${inputs.boxKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get box' };
                return { output: data };
            }

            case 'createBox': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/boxes`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        stageKey: inputs.stageKey,
                        assignedToSharingEntries: inputs.assignedTo ? [{ email: inputs.assignedTo }] : undefined,
                        notes: inputs.notes,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create box' };
                return { output: data };
            }

            case 'updateBox': {
                const res = await fetch(`${baseUrl}/boxes/${inputs.boxKey}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        stageKey: inputs.stageKey,
                        notes: inputs.notes,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to update box' };
                return { output: data };
            }

            case 'deleteBox': {
                const res = await fetch(`${baseUrl}/boxes/${inputs.boxKey}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to delete box' };
                return { output: data };
            }

            case 'listStages': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/stages`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list stages' };
                return { output: data };
            }

            case 'getStage': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/stages/${inputs.stageKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get stage' };
                return { output: data };
            }

            case 'createStage': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/stages`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create stage' };
                return { output: data };
            }

            case 'listFields': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/fields`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list fields' };
                return { output: data };
            }

            case 'createField': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineKey}/fields`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        type: inputs.type,
                        enumOptions: inputs.enumOptions,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to create field' };
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/contacts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to list contacts' };
                return { output: data };
            }

            case 'getContact': {
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactKey}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'Failed to get contact' };
                return { output: data };
            }

            default:
                return { error: `Unknown Streak CRM action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Streak CRM action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred' };
    }
}
