'use server';

export async function executeAppSheetAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const appId = String(inputs.appId ?? '').trim();
        if (!appId) throw new Error('appId is required.');

        const BASE = `https://api.appsheet.com/api/v2/apps/${appId}/tables`;

        const headers: Record<string, string> = {
            'ApplicationAccessKey': apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'getRows': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const body: Record<string, any> = { Action: 'Find', Properties: {} };
                if (inputs.selector) body.Properties.Selector = inputs.selector;
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { rows: data } };
            }
            case 'addRows': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : [inputs.rows];
                const body = { Action: 'Add', Properties: {}, Rows: rows };
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'editRows': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : [inputs.rows];
                const body = { Action: 'Edit', Properties: {}, Rows: rows };
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'deleteRows': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : [inputs.rows];
                const body = { Action: 'Delete', Properties: {}, Rows: rows };
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'getActions': {
                const res = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/actions`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { actions: data } };
            }
            case 'invokeAction': {
                const tableName = String(inputs.tableName ?? '').trim();
                const actionName2 = String(inputs.actionName ?? '').trim();
                if (!tableName || !actionName2) throw new Error('tableName and actionName are required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : (inputs.rows ? [inputs.rows] : []);
                const body = {
                    Action: actionName2,
                    Properties: inputs.properties ?? {},
                    Rows: rows,
                };
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'getFiles': {
                const tableName = String(inputs.tableName ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                const column = String(inputs.column ?? '').trim();
                if (!tableName || !rowId || !column) throw new Error('tableName, rowId, and column are required.');
                const res = await fetch(
                    `${BASE}/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(rowId)}/columns/${encodeURIComponent(column)}/file`,
                    { headers }
                );
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData?.Message || `API error: ${res.status}`);
                }
                const contentType = res.headers.get('content-type') ?? '';
                const fileUrl = res.url;
                return { output: { fileUrl, contentType } };
            }
            case 'addFiles': {
                const tableName = String(inputs.tableName ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                const column = String(inputs.column ?? '').trim();
                const fileContent = inputs.fileContent;
                if (!tableName || !rowId || !column || !fileContent) throw new Error('tableName, rowId, column, and fileContent are required.');
                const uploadHeaders: Record<string, string> = {
                    'ApplicationAccessKey': apiKey,
                    'Content-Type': inputs.contentType ?? 'application/octet-stream',
                };
                const res = await fetch(
                    `${BASE}/${encodeURIComponent(tableName)}/rows/${encodeURIComponent(rowId)}/columns/${encodeURIComponent(column)}/file`,
                    { method: 'POST', headers: uploadHeaders, body: fileContent }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            case 'listTables': {
                const res = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/tables`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { tables: data } };
            }
            case 'getTableStructure': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { structure: data } };
            }
            case 'listColumns': {
                const tableName = String(inputs.tableName ?? '').trim();
                if (!tableName) throw new Error('tableName is required.');
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/columns`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { columns: data } };
            }
            case 'getColumnValues': {
                const tableName = String(inputs.tableName ?? '').trim();
                const column = String(inputs.column ?? '').trim();
                if (!tableName || !column) throw new Error('tableName and column are required.');
                const body = {
                    Action: 'Find',
                    Properties: { Selector: `SELECT(${tableName}[${column}], TRUE)` },
                };
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { values: data } };
            }
            case 'searchRows': {
                const tableName = String(inputs.tableName ?? '').trim();
                const selector = String(inputs.selector ?? '').trim();
                if (!tableName || !selector) throw new Error('tableName and selector are required.');
                const body = { Action: 'Find', Properties: { Selector: selector } };
                const res = await fetch(`${BASE}/${encodeURIComponent(tableName)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { rows: data } };
            }
            case 'getRelatedRows': {
                const tableName = String(inputs.tableName ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                const relatedTable = String(inputs.relatedTable ?? '').trim();
                if (!tableName || !rowId || !relatedTable) throw new Error('tableName, rowId, and relatedTable are required.');
                const selector = `FILTER(${relatedTable}, [RelatedKey] = "${rowId}")`;
                const body = { Action: 'Find', Properties: { Selector: selector } };
                const res = await fetch(`${BASE}/${encodeURIComponent(relatedTable)}/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { relatedRows: data } };
            }
            case 'runReport': {
                const reportName = String(inputs.reportName ?? '').trim();
                if (!reportName) throw new Error('reportName is required.');
                const body = {
                    Action: 'Run',
                    Properties: { ReportName: reportName },
                    Rows: [],
                };
                const res = await fetch(`https://api.appsheet.com/api/v2/apps/${appId}/reports/Action`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.Message || `API error: ${res.status}`);
                return { output: { result: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
