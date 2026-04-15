'use server';

export async function executeSmartsheetAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accessToken } = inputs;
        if (!accessToken) return { error: 'Smartsheet accessToken is required.' };

        const BASE = 'https://api.smartsheet.com/2.0';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        let res: Response;

        switch (actionName) {
            case 'listSheets': {
                res = await fetch(`${BASE}/sheets`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list sheets.' };
                return { output: data };
            }
            case 'getSheet': {
                const { sheetId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get sheet.' };
                return { output: data };
            }
            case 'createSheet': {
                const { name, columns } = inputs;
                res = await fetch(`${BASE}/sheets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name, columns }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create sheet.' };
                return { output: data };
            }
            case 'updateSheet': {
                const { sheetId, name } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ name }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update sheet.' };
                return { output: data };
            }
            case 'deleteSheet': {
                const { sheetId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete sheet.' };
                return { output: { success: true, result: data } };
            }
            case 'listRows': {
                const { sheetId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/rows`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list rows.' };
                return { output: data };
            }
            case 'getRow': {
                const { sheetId, rowId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/rows/${rowId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get row.' };
                return { output: data };
            }
            case 'addRow': {
                const { sheetId, cells, toTop, toBottom, parentId, siblingId } = inputs;
                const rowPayload: any = { cells };
                if (toTop !== undefined) rowPayload.toTop = toTop;
                if (toBottom !== undefined) rowPayload.toBottom = toBottom;
                if (parentId) rowPayload.parentId = parentId;
                if (siblingId) rowPayload.siblingId = siblingId;
                res = await fetch(`${BASE}/sheets/${sheetId}/rows`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([rowPayload]),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add row.' };
                return { output: data };
            }
            case 'updateRow': {
                const { sheetId, rowId, cells } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/rows`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify([{ id: rowId, cells }]),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update row.' };
                return { output: data };
            }
            case 'deleteRow': {
                const { sheetId, rowId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/rows?ids=${rowId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete row.' };
                return { output: { success: true, result: data } };
            }
            case 'listColumns': {
                const { sheetId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/columns`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list columns.' };
                return { output: data };
            }
            case 'addColumn': {
                const { sheetId, title, type, index } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/columns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ title, type, index }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add column.' };
                return { output: data };
            }
            case 'updateColumn': {
                const { sheetId, columnId, title, index } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/columns/${columnId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ title, index }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update column.' };
                return { output: data };
            }
            case 'searchSheet': {
                const { sheetId, query } = inputs;
                res = await fetch(`${BASE}/search/sheets/${sheetId}?query=${encodeURIComponent(query)}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to search sheet.' };
                return { output: data };
            }
            case 'getAttachments': {
                const { sheetId } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/attachments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get attachments.' };
                return { output: data };
            }
            case 'addAttachment': {
                const { sheetId, url, attachmentType, name } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/attachments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ url, attachmentType, name }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add attachment.' };
                return { output: data };
            }
            case 'shareSheet': {
                const { sheetId, email, accessLevel, message } = inputs;
                res = await fetch(`${BASE}/sheets/${sheetId}/shares`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([{ email, accessLevel, message }]),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to share sheet.' };
                return { output: data };
            }
            case 'listReports': {
                res = await fetch(`${BASE}/reports`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list reports.' };
                return { output: data };
            }
            default:
                return { error: `Smartsheet action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred in Smartsheet action.' };
    }
}
