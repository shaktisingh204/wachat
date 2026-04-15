'use server';

export async function executeGoogleBigqueryAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, projectId, datasetId, tableId, location, query, jobId, rows, destinationDatasetId, destinationTableId, maxResults, pageToken, filter } = inputs;
    const base = 'https://bigquery.googleapis.com/bigquery/v2';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listDatasets': {
                const params = new URLSearchParams();
                if (maxResults) params.set('maxResults', String(maxResults));
                if (pageToken) params.set('pageToken', pageToken);
                if (filter) params.set('filter', filter);
                const url = `${base}/projects/${projectId}/datasets?${params}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listDatasets failed' };
                return { output: data };
            }
            case 'createDataset': {
                const body: any = { datasetReference: { projectId, datasetId } };
                if (location) body.location = location;
                const res = await fetch(`${base}/projects/${projectId}/datasets`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createDataset failed' };
                return { output: data };
            }
            case 'deleteDataset': {
                const deleteContents = inputs.deleteContents ? '?deleteContents=true' : '';
                const res = await fetch(`${base}/projects/${projectId}/datasets/${datasetId}${deleteContents}`, {
                    method: 'DELETE', headers,
                });
                if (res.status === 204 || res.ok) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteDataset failed' };
            }
            case 'listTables': {
                const params = new URLSearchParams();
                if (maxResults) params.set('maxResults', String(maxResults));
                if (pageToken) params.set('pageToken', pageToken);
                const res = await fetch(`${base}/projects/${projectId}/datasets/${datasetId}/tables?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listTables failed' };
                return { output: data };
            }
            case 'getTable': {
                const res = await fetch(`${base}/projects/${projectId}/datasets/${datasetId}/tables/${tableId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getTable failed' };
                return { output: data };
            }
            case 'createTable': {
                const schema = inputs.schema || {};
                const body: any = {
                    tableReference: { projectId, datasetId, tableId },
                    schema,
                };
                if (inputs.description) body.description = inputs.description;
                const res = await fetch(`${base}/projects/${projectId}/datasets/${datasetId}/tables`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createTable failed' };
                return { output: data };
            }
            case 'deleteTable': {
                const res = await fetch(`${base}/projects/${projectId}/datasets/${datasetId}/tables/${tableId}`, {
                    method: 'DELETE', headers,
                });
                if (res.status === 204 || res.ok) return { output: { success: true } };
                const data = await res.json();
                return { error: data.error?.message || 'deleteTable failed' };
            }
            case 'insertRows': {
                const insertId = inputs.insertId;
                const rowsArray = Array.isArray(rows) ? rows : [rows];
                const body = {
                    rows: rowsArray.map((r: any, i: number) => ({
                        insertId: insertId ? `${insertId}-${i}` : String(i),
                        json: r,
                    })),
                };
                const res = await fetch(`${base}/projects/${projectId}/datasets/${datasetId}/tables/${tableId}/insertAll`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'insertRows failed' };
                return { output: data };
            }
            case 'runQuery': {
                const body: any = {
                    query,
                    useLegacySql: inputs.useLegacySql ?? false,
                };
                if (maxResults) body.maxResults = Number(maxResults);
                if (location) body.location = location;
                const res = await fetch(`${base}/projects/${projectId}/queries`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'runQuery failed' };
                return { output: data };
            }
            case 'createJob': {
                const body: any = {
                    configuration: {
                        query: {
                            query,
                            useLegacySql: inputs.useLegacySql ?? false,
                        },
                    },
                };
                if (location) body.jobReference = { projectId, location };
                const res = await fetch(`${base}/projects/${projectId}/jobs`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createJob failed' };
                return { output: data };
            }
            case 'getJob': {
                const res = await fetch(`${base}/projects/${projectId}/jobs/${jobId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getJob failed' };
                return { output: data };
            }
            case 'listJobs': {
                const params = new URLSearchParams();
                if (maxResults) params.set('maxResults', String(maxResults));
                if (pageToken) params.set('pageToken', pageToken);
                if (inputs.stateFilter) params.set('stateFilter', inputs.stateFilter);
                const res = await fetch(`${base}/projects/${projectId}/jobs?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listJobs failed' };
                return { output: data };
            }
            case 'getQueryResults': {
                const params = new URLSearchParams();
                if (maxResults) params.set('maxResults', String(maxResults));
                if (pageToken) params.set('pageToken', pageToken);
                if (location) params.set('location', location);
                const res = await fetch(`${base}/projects/${projectId}/queries/${jobId}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getQueryResults failed' };
                return { output: data };
            }
            case 'listProjects': {
                const params = new URLSearchParams();
                if (maxResults) params.set('maxResults', String(maxResults));
                if (pageToken) params.set('pageToken', pageToken);
                const res = await fetch(`${base}/projects?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listProjects failed' };
                return { output: data };
            }
            case 'copyTable': {
                const body = {
                    configuration: {
                        copy: {
                            sourceTables: [{ projectId, datasetId, tableId }],
                            destinationTable: {
                                projectId: inputs.destinationProjectId || projectId,
                                datasetId: destinationDatasetId,
                                tableId: destinationTableId,
                            },
                            writeDisposition: inputs.writeDisposition || 'WRITE_TRUNCATE',
                        },
                    },
                };
                const res = await fetch(`${base}/projects/${projectId}/jobs`, {
                    method: 'POST', headers, body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'copyTable failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown BigQuery action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`BigQuery action error: ${err.message}`);
        return { error: err.message || 'BigQuery action failed' };
    }
}
