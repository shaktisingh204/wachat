'use server';

const BASE = 'https://sheets.googleapis.com/v4';
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

async function req(accessToken: string, method: string, url: string, body?: any, logger?: any) {
    logger?.log(`[GSheetsEnhanced] ${method} ${url}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Sheets API error ${res.status}`);
    return data;
}

export async function executeGoogleSheetsEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const g = (method: string, url: string, body?: any) => req(accessToken, method, url, body, logger);

        switch (actionName) {
            case 'listSpreadsheets': {
                const pageSize = Number(inputs.pageSize ?? 30);
                const query = `mimeType='application/vnd.google-apps.spreadsheet'`;
                const data = await g('GET', `${DRIVE_BASE}/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}&fields=files(id,name,modifiedTime,webViewLink),nextPageToken`);
                return { output: { spreadsheets: data.files ?? [], count: (data.files ?? []).length, nextPageToken: data.nextPageToken ?? '' } };
            }

            case 'getSpreadsheet': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const data = await g('GET', `${BASE}/spreadsheets/${spreadsheetId}?includeGridData=false`);
                return { output: { spreadsheetId: data.spreadsheetId, title: data.properties?.title ?? '', sheets: (data.sheets ?? []).map((s: any) => ({ sheetId: s.properties?.sheetId, title: s.properties?.title, index: s.properties?.index })) } };
            }

            case 'createSpreadsheet': {
                const title = String(inputs.title ?? 'New Spreadsheet').trim();
                const data = await g('POST', `${BASE}/spreadsheets`, { properties: { title } });
                return { output: { spreadsheetId: data.spreadsheetId, title: data.properties?.title ?? title, spreadsheetUrl: data.spreadsheetUrl ?? '' } };
            }

            case 'addSheet': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const title = String(inputs.title ?? 'New Sheet').trim();
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const data = await g('POST', `${BASE}/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    requests: [{ addSheet: { properties: { title } } }],
                });
                const added = data.replies?.[0]?.addSheet?.properties ?? {};
                return { output: { sheetId: added.sheetId, title: added.title ?? title } };
            }

            case 'deleteSheet': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const sheetId = Number(inputs.sheetId ?? 0);
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                await g('POST', `${BASE}/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    requests: [{ deleteSheet: { sheetId } }],
                });
                return { output: { deleted: true, spreadsheetId, sheetId } };
            }

            case 'getValues': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const range = String(inputs.range ?? '').trim();
                if (!spreadsheetId || !range) throw new Error('spreadsheetId and range are required.');
                const data = await g('GET', `${BASE}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`);
                return { output: { values: data.values ?? [], rowCount: (data.values ?? []).length, range: data.range ?? range } };
            }

            case 'setValues': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const range = String(inputs.range ?? '').trim();
                const values = inputs.values ?? [[]];
                if (!spreadsheetId || !range) throw new Error('spreadsheetId and range are required.');
                const data = await g('PUT', `${BASE}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${inputs.valueInputOption ?? 'USER_ENTERED'}`, { range, majorDimension: 'ROWS', values });
                return { output: { updatedRange: data.updatedRange ?? range, updatedRows: data.updatedRows ?? 0, updatedCells: data.updatedCells ?? 0 } };
            }

            case 'appendValues': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const range = String(inputs.range ?? '').trim();
                const values = inputs.values ?? [[]];
                if (!spreadsheetId || !range) throw new Error('spreadsheetId and range are required.');
                const data = await g('POST', `${BASE}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${inputs.valueInputOption ?? 'USER_ENTERED'}&insertDataOption=INSERT_ROWS`, { range, majorDimension: 'ROWS', values });
                return { output: { tableRange: data.tableRange ?? '', updatedRange: data.updates?.updatedRange ?? '', updatedRows: data.updates?.updatedRows ?? 0 } };
            }

            case 'clearValues': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const range = String(inputs.range ?? '').trim();
                if (!spreadsheetId || !range) throw new Error('spreadsheetId and range are required.');
                const data = await g('POST', `${BASE}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {});
                return { output: { clearedRange: data.clearedRange ?? range, spreadsheetId } };
            }

            case 'batchGetValues': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const ranges: string[] = Array.isArray(inputs.ranges) ? inputs.ranges : String(inputs.ranges ?? '').split(',').map((r: string) => r.trim()).filter(Boolean);
                if (!spreadsheetId || !ranges.length) throw new Error('spreadsheetId and ranges are required.');
                const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
                const data = await g('GET', `${BASE}/spreadsheets/${spreadsheetId}/values:batchGet?${qs}`);
                return { output: { valueRanges: data.valueRanges ?? [], count: (data.valueRanges ?? []).length } };
            }

            case 'batchSetValues': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const data_payload = inputs.data ?? [];
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const data = await g('POST', `${BASE}/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
                    valueInputOption: inputs.valueInputOption ?? 'USER_ENTERED',
                    data: data_payload,
                });
                return { output: { totalUpdatedRows: data.totalUpdatedRows ?? 0, totalUpdatedCells: data.totalUpdatedCells ?? 0, responses: data.responses ?? [] } };
            }

            case 'formatRange': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const sheetId = Number(inputs.sheetId ?? 0);
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const startRowIndex = Number(inputs.startRowIndex ?? 0);
                const endRowIndex = Number(inputs.endRowIndex ?? 1);
                const startColumnIndex = Number(inputs.startColumnIndex ?? 0);
                const endColumnIndex = Number(inputs.endColumnIndex ?? 1);
                const userEnteredFormat = inputs.userEnteredFormat ?? {};
                await g('POST', `${BASE}/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    requests: [{
                        repeatCell: {
                            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
                            cell: { userEnteredFormat },
                            fields: 'userEnteredFormat',
                        },
                    }],
                });
                return { output: { formatted: true, spreadsheetId, sheetId } };
            }

            case 'mergeRange': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const sheetId = Number(inputs.sheetId ?? 0);
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const startRowIndex = Number(inputs.startRowIndex ?? 0);
                const endRowIndex = Number(inputs.endRowIndex ?? 1);
                const startColumnIndex = Number(inputs.startColumnIndex ?? 0);
                const endColumnIndex = Number(inputs.endColumnIndex ?? 1);
                const mergeType = String(inputs.mergeType ?? 'MERGE_ALL');
                await g('POST', `${BASE}/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    requests: [{
                        mergeCells: {
                            range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
                            mergeType,
                        },
                    }],
                });
                return { output: { merged: true, spreadsheetId, sheetId, mergeType } };
            }

            case 'addConditionalFormatting': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const sheetId = Number(inputs.sheetId ?? 0);
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const rule = inputs.rule ?? {};
                const startRowIndex = Number(inputs.startRowIndex ?? 0);
                const endRowIndex = Number(inputs.endRowIndex ?? 100);
                const startColumnIndex = Number(inputs.startColumnIndex ?? 0);
                const endColumnIndex = Number(inputs.endColumnIndex ?? 10);
                await g('POST', `${BASE}/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    requests: [{
                        addConditionalFormatRule: {
                            rule: {
                                ranges: [{ sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }],
                                ...rule,
                            },
                            index: 0,
                        },
                    }],
                });
                return { output: { added: true, spreadsheetId, sheetId } };
            }

            case 'createChart': {
                const spreadsheetId = String(inputs.spreadsheetId ?? '').trim();
                const sheetId = Number(inputs.sheetId ?? 0);
                if (!spreadsheetId) throw new Error('spreadsheetId is required.');
                const chartType = String(inputs.chartType ?? 'COLUMN');
                const title = String(inputs.title ?? 'Chart').trim();
                const domainRange = inputs.domainRange ?? {};
                const seriesRange = inputs.seriesRange ?? {};
                const data = await g('POST', `${BASE}/spreadsheets/${spreadsheetId}:batchUpdate`, {
                    requests: [{
                        addChart: {
                            chart: {
                                spec: {
                                    title,
                                    basicChart: {
                                        chartType,
                                        legendPosition: 'BOTTOM_LEGEND',
                                        domains: [{ domain: { sourceRange: { sources: [domainRange] } } }],
                                        series: [{ series: { sourceRange: { sources: [seriesRange] } }, targetAxis: 'LEFT_AXIS' }],
                                    },
                                },
                                position: { newSheet: false, overlayPosition: { anchorCell: { sheetId, rowIndex: 0, columnIndex: 0 } } },
                            },
                        },
                    }],
                });
                const chartId = data.replies?.[0]?.addChart?.chart?.chartId ?? null;
                return { output: { chartId, spreadsheetId, sheetId, title } };
            }

            default:
                return { error: `Google Sheets Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Sheets Enhanced action failed.' };
    }
}
