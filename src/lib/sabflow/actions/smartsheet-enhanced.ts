'use server';

const SMARTSHEET_BASE = 'https://api.smartsheet.com/2.0';

export async function executeSmartsheetEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listSheets': {
                const params = new URLSearchParams();
                if (inputs.includeAll) params.set('includeAll', 'true');
                if (inputs.modifiedSince) params.set('modifiedSince', String(inputs.modifiedSince));
                const res = await fetch(`${SMARTSHEET_BASE}/sheets?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { sheets: data.data, totalCount: data.totalCount, pageNumber: data.pageNumber } };
            }
            case 'getSheet': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const params = new URLSearchParams();
                if (inputs.include) params.set('include', String(inputs.include));
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { sheet: data } };
            }
            case 'createSheet': {
                const body = {
                    name: inputs.name,
                    columns: inputs.columns ?? [],
                };
                const res = await fetch(`${SMARTSHEET_BASE}/sheets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result, id: data.result?.id } };
            }
            case 'copySheet': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const body = {
                    destinationId: inputs.destinationId,
                    destinationType: inputs.destinationType ?? 'home',
                    newName: inputs.newName,
                    include: inputs.include,
                };
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/copy`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'updateSheet': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'deleteSheet': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { message: data.message } };
            }
            case 'addRows': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : [inputs.rows];
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/rows`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(rows),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'getRow': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                const rowId = String(inputs.rowId ?? '').trim();
                if (!sheetId || !rowId) throw new Error('sheetId and rowId are required.');
                const params = new URLSearchParams();
                if (inputs.include) params.set('include', String(inputs.include));
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/rows/${rowId}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { row: data } };
            }
            case 'updateRow': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const rows = Array.isArray(inputs.rows) ? inputs.rows : [inputs.rows];
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/rows`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(rows),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'deleteRow': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                const rowIds = String(inputs.rowIds ?? '').trim();
                if (!sheetId || !rowIds) throw new Error('sheetId and rowIds are required.');
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/rows?ids=${rowIds}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deletedRowIds: data.result } };
            }
            case 'addColumns': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const columns = Array.isArray(inputs.columns) ? inputs.columns : [inputs.columns];
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/columns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(columns),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'updateColumn': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                const columnId = String(inputs.columnId ?? '').trim();
                if (!sheetId || !columnId) throw new Error('sheetId and columnId are required.');
                const body: Record<string, any> = {};
                if (inputs.title !== undefined) body.title = inputs.title;
                if (inputs.index !== undefined) body.index = inputs.index;
                if (inputs.type !== undefined) body.type = inputs.type;
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/columns/${columnId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'deleteColumn': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                const columnId = String(inputs.columnId ?? '').trim();
                if (!sheetId || !columnId) throw new Error('sheetId and columnId are required.');
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/columns/${columnId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { message: data.message } };
            }
            case 'shareSheet': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const shares = Array.isArray(inputs.shares) ? inputs.shares : [inputs.shares];
                const params = new URLSearchParams();
                if (inputs.sendEmail !== undefined) params.set('sendEmail', String(inputs.sendEmail));
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/shares?${params}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(shares),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { result: data.result } };
            }
            case 'getSheetAttachments': {
                const sheetId = String(inputs.sheetId ?? '').trim();
                if (!sheetId) throw new Error('sheetId is required.');
                const res = await fetch(`${SMARTSHEET_BASE}/sheets/${sheetId}/attachments`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { attachments: data.data, totalCount: data.totalCount } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
