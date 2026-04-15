'use server';

export async function executeBigQueryEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { accessToken, projectId } = inputs;
        const baseUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'runQuery': {
                const body: Record<string, any> = {
                    query: inputs.query,
                    useLegacySql: inputs.useLegacySql ?? false,
                };
                if (inputs.location) body.location = inputs.location;
                if (inputs.maxResults) body.maxResults = inputs.maxResults;
                if (inputs.timeoutMs) body.timeoutMs = inputs.timeoutMs;
                const res = await fetch(`${baseUrl}/queries`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'runQuery failed' };
                return { output: data };
            }

            case 'createQueryJob': {
                const body = {
                    configuration: {
                        query: {
                            query: inputs.query,
                            useLegacySql: inputs.useLegacySql ?? false,
                            ...(inputs.destinationTable ? { destinationTable: inputs.destinationTable } : {}),
                        },
                    },
                };
                const res = await fetch(`${baseUrl}/jobs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'createQueryJob failed' };
                return { output: data };
            }

            case 'getJobResults': {
                const { jobId } = inputs;
                const params = new URLSearchParams();
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.startIndex) params.set('startIndex', String(inputs.startIndex));
                const res = await fetch(`${baseUrl}/queries/${jobId}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'getJobResults failed' };
                return { output: data };
            }

            case 'listDatasets': {
                const params = new URLSearchParams();
                if (inputs.all) params.set('all', 'true');
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/datasets?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'listDatasets failed' };
                return { output: data };
            }

            case 'getDataset': {
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'getDataset failed' };
                return { output: data };
            }

            case 'createDataset': {
                const body = {
                    datasetReference: {
                        projectId,
                        datasetId: inputs.datasetId,
                    },
                    location: inputs.location ?? 'US',
                    ...(inputs.description ? { description: inputs.description } : {}),
                };
                const res = await fetch(`${baseUrl}/datasets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'createDataset failed' };
                return { output: data };
            }

            case 'deleteDataset': {
                const params = new URLSearchParams();
                if (inputs.deleteContents) params.set('deleteContents', 'true');
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}?${params}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204 || res.status === 200) return { output: { success: true } };
                const data = await res.json();
                return { error: data?.error?.message ?? 'deleteDataset failed' };
            }

            case 'listTables': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/tables?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'listTables failed' };
                return { output: data };
            }

            case 'getTable': {
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/tables/${inputs.tableId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'getTable failed' };
                return { output: data };
            }

            case 'createTable': {
                const body: Record<string, any> = {
                    tableReference: {
                        projectId,
                        datasetId: inputs.datasetId,
                        tableId: inputs.tableId,
                    },
                };
                if (inputs.schema) body.schema = inputs.schema;
                if (inputs.description) body.description = inputs.description;
                if (inputs.expirationTime) body.expirationTime = inputs.expirationTime;
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/tables`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'createTable failed' };
                return { output: data };
            }

            case 'deleteTable': {
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/tables/${inputs.tableId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204 || res.status === 200) return { output: { success: true } };
                const data = await res.json();
                return { error: data?.error?.message ?? 'deleteTable failed' };
            }

            case 'insertRows': {
                const body = {
                    rows: inputs.rows,
                    skipInvalidRows: inputs.skipInvalidRows ?? false,
                    ignoreUnknownValues: inputs.ignoreUnknownValues ?? false,
                };
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetId}/tables/${inputs.tableId}/insertAll`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'insertRows failed' };
                return { output: data };
            }

            case 'listJobs': {
                const params = new URLSearchParams();
                params.set('allUsers', inputs.allUsers ? 'true' : 'false');
                if (inputs.maxResults) params.set('maxResults', String(inputs.maxResults));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                if (inputs.projection) params.set('projection', inputs.projection);
                if (inputs.stateFilter) params.set('stateFilter', inputs.stateFilter);
                const res = await fetch(`${baseUrl}/jobs?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'listJobs failed' };
                return { output: data };
            }

            case 'getJob': {
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'getJob failed' };
                return { output: data };
            }

            case 'cancelJob': {
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error?.message ?? 'cancelJob failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown BigQuery Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`BigQuery Enhanced action error: ${err?.message}`);
        return { error: err?.message ?? 'Unknown error in BigQuery Enhanced action' };
    }
}
