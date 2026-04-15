'use server';

export async function executeAdaloAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = `https://api.adalo.com/v0/apps/${inputs.appId}/collections`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listRecords': {
                const params = new URLSearchParams();
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                if (inputs.offset !== undefined) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/${inputs.collectionId}${qs}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to list records: ${res.status}` };
                return { output: data };
            }

            case 'getRecord': {
                const res = await fetch(`${baseUrl}/${inputs.collectionId}/${inputs.recordId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to get record: ${res.status}` };
                return { output: data };
            }

            case 'createRecord': {
                const res = await fetch(`${baseUrl}/${inputs.collectionId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to create record: ${res.status}` };
                return { output: data };
            }

            case 'updateRecord': {
                const res = await fetch(`${baseUrl}/${inputs.collectionId}/${inputs.recordId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.data || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to update record: ${res.status}` };
                return { output: data };
            }

            case 'deleteRecord': {
                const res = await fetch(`${baseUrl}/${inputs.collectionId}/${inputs.recordId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data?.message || `Failed to delete record: ${res.status}` };
                }
                return { output: { success: true } };
            }

            case 'getCollections': {
                return { error: 'Adalo does not expose a collections list endpoint via the public API. Please provide the collectionId directly.' };
            }

            case 'searchRecords': {
                const params = new URLSearchParams();
                if (inputs.limit !== undefined) params.set('limit', String(inputs.limit));
                if (inputs.offset !== undefined) params.set('offset', String(inputs.offset));
                if (inputs.filterField && inputs.filterValue) {
                    params.set(inputs.filterField, inputs.filterValue);
                }
                if (inputs.filters && typeof inputs.filters === 'object') {
                    for (const [key, val] of Object.entries(inputs.filters)) {
                        params.set(key, String(val));
                    }
                }
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/${inputs.collectionId}${qs}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to search records: ${res.status}` };
                return { output: data };
            }

            case 'countRecords': {
                const params = new URLSearchParams();
                if (inputs.limit !== undefined) params.set('limit', '1');
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/${inputs.collectionId}${qs}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message || `Failed to count records: ${res.status}` };
                const count = data?.totalCount ?? data?.count ?? (Array.isArray(data?.records) ? data.records.length : null);
                return { output: { count, raw: data } };
            }

            default:
                return { error: `Adalo action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Adalo action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred in Adalo action.' };
    }
}
