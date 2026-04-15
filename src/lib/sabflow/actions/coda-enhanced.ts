'use server';

export async function executeCodaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiToken = inputs.apiToken;
    const baseUrl = 'https://coda.io/apis/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listDocs': {
                const params = new URLSearchParams();
                if (inputs.isOwner !== undefined) params.append('isOwner', String(inputs.isOwner));
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.pageToken) params.append('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/docs?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list docs' };
                return { output: data };
            }
            case 'getDoc': {
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get doc' };
                return { output: data };
            }
            case 'createDoc': {
                const body: Record<string, any> = { title: inputs.title || 'New Doc' };
                if (inputs.sourceDoc) body.sourceDoc = inputs.sourceDoc;
                if (inputs.timezone) body.timezone = inputs.timezone;
                const res = await fetch(`${baseUrl}/docs`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create doc' };
                return { output: data };
            }
            case 'listPages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.pageToken) params.append('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/pages?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list pages' };
                return { output: data };
            }
            case 'getPage': {
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/pages/${inputs.pageIdOrName}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get page' };
                return { output: data };
            }
            case 'createPage': {
                const body: Record<string, any> = { name: inputs.name || 'New Page' };
                if (inputs.subtitle) body.subtitle = inputs.subtitle;
                if (inputs.pageContent) body.pageContent = inputs.pageContent;
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/pages`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create page' };
                return { output: data };
            }
            case 'listTables': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.pageToken) params.append('pageToken', inputs.pageToken);
                if (inputs.tableTypes) params.append('tableTypes', inputs.tableTypes);
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list tables' };
                return { output: data };
            }
            case 'getTable': {
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables/${inputs.tableIdOrName}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get table' };
                return { output: data };
            }
            case 'listRows': {
                const params = new URLSearchParams();
                if (inputs.query) params.append('query', inputs.query);
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.pageToken) params.append('pageToken', inputs.pageToken);
                if (inputs.useColumnNames !== undefined) params.append('useColumnNames', String(inputs.useColumnNames));
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables/${inputs.tableIdOrName}/rows?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list rows' };
                return { output: data };
            }
            case 'getRow': {
                const params = new URLSearchParams();
                if (inputs.useColumnNames !== undefined) params.append('useColumnNames', String(inputs.useColumnNames));
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables/${inputs.tableIdOrName}/rows/${inputs.rowIdOrName}?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get row' };
                return { output: data };
            }
            case 'insertRows': {
                const body: Record<string, any> = { rows: inputs.rows || [] };
                if (inputs.keyColumns) body.keyColumns = inputs.keyColumns;
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables/${inputs.tableIdOrName}/rows`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to insert rows' };
                return { output: data };
            }
            case 'updateRow': {
                const body: Record<string, any> = { row: { cells: inputs.cells || [] } };
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables/${inputs.tableIdOrName}/rows/${inputs.rowIdOrName}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update row' };
                return { output: data };
            }
            case 'deleteRow': {
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/tables/${inputs.tableIdOrName}/rows/${inputs.rowIdOrName}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete row' };
                return { output: data };
            }
            case 'listFormulas': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.pageToken) params.append('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/docs/${inputs.docId}/formulas?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list formulas' };
                return { output: data };
            }
            case 'resolveLink': {
                const params = new URLSearchParams({ url: inputs.url });
                if (inputs.degradeGracefully !== undefined) params.append('degradeGracefully', String(inputs.degradeGracefully));
                const res = await fetch(`${baseUrl}/resolveBrowserLink?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to resolve link' };
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || 'Unexpected error in coda-enhanced action' };
    }
}
