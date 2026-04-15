
'use server';

const GDOCS_BASE = 'https://docs.googleapis.com/v1';

async function gdocsFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Google Docs] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${GDOCS_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message || `Google Docs API error: ${res.status}`);
    }
    return data;
}

export async function executeGoogleDocsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const gdocs = (method: string, path: string, body?: any) => gdocsFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'createDocument': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const data = await gdocs('POST', '/documents', { title });
                return { output: { documentId: data.documentId, title: data.title, revisionId: data.revisionId ?? '' } };
            }

            case 'getDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                if (!documentId) throw new Error('documentId is required.');
                const data = await gdocs('GET', `/documents/${documentId}`);
                const content = extractTextFromBody(data.body);
                return { output: { documentId: data.documentId, title: data.title, content, revisionId: data.revisionId ?? '' } };
            }

            case 'appendText': {
                const documentId = String(inputs.documentId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!documentId || !text) throw new Error('documentId and text are required.');
                // Get current end index
                const doc = await gdocs('GET', `/documents/${documentId}`);
                const endIndex = getDocEndIndex(doc);
                const data = await gdocs('POST', `/documents/${documentId}:batchUpdate`, {
                    requests: [{ insertText: { location: { index: endIndex - 1 }, text: '\n' + text } }],
                });
                return { output: { documentId, revisionId: data.writeControl?.requiredRevisionId ?? '' } };
            }

            case 'insertText': {
                const documentId = String(inputs.documentId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                const index = Number(inputs.index ?? 1);
                if (!documentId || !text) throw new Error('documentId and text are required.');
                const data = await gdocs('POST', `/documents/${documentId}:batchUpdate`, {
                    requests: [{ insertText: { location: { index }, text } }],
                });
                return { output: { documentId, revisionId: data.writeControl?.requiredRevisionId ?? '' } };
            }

            case 'replaceText': {
                const documentId = String(inputs.documentId ?? '').trim();
                const searchText = String(inputs.searchText ?? '').trim();
                const replaceText = String(inputs.replaceText ?? '').trim();
                const matchCase = inputs.matchCase !== false;
                if (!documentId || !searchText) throw new Error('documentId and searchText are required.');
                const data = await gdocs('POST', `/documents/${documentId}:batchUpdate`, {
                    requests: [{ replaceAllText: { containsText: { text: searchText, matchCase }, replaceText } }],
                });
                return { output: { documentId, occurrencesChanged: String(data.replies?.[0]?.replaceAllText?.occurrencesChanged ?? 0) } };
            }

            case 'deleteContent': {
                const documentId = String(inputs.documentId ?? '').trim();
                const startIndex = Number(inputs.startIndex ?? 1);
                const endIndex = Number(inputs.endIndex ?? 1);
                if (!documentId) throw new Error('documentId is required.');
                const data = await gdocs('POST', `/documents/${documentId}:batchUpdate`, {
                    requests: [{ deleteContentRange: { range: { startIndex, endIndex } } }],
                });
                return { output: { documentId } };
            }

            case 'applyFormatting': {
                const documentId = String(inputs.documentId ?? '').trim();
                const startIndex = Number(inputs.startIndex ?? 1);
                const endIndex = Number(inputs.endIndex ?? 2);
                const bold = inputs.bold === true || inputs.bold === 'true';
                const italic = inputs.italic === true || inputs.italic === 'true';
                const fontSize = inputs.fontSize ? Number(inputs.fontSize) : undefined;
                if (!documentId) throw new Error('documentId is required.');
                const textStyle: any = {};
                const fields: string[] = [];
                if (bold !== undefined) { textStyle.bold = bold; fields.push('bold'); }
                if (italic !== undefined) { textStyle.italic = italic; fields.push('italic'); }
                if (fontSize) { textStyle.fontSize = { magnitude: fontSize, unit: 'PT' }; fields.push('fontSize'); }
                const data = await gdocs('POST', `/documents/${documentId}:batchUpdate`, {
                    requests: [{ updateTextStyle: { range: { startIndex, endIndex }, textStyle, fields: fields.join(',') } }],
                });
                return { output: { documentId } };
            }

            case 'addTable': {
                const documentId = String(inputs.documentId ?? '').trim();
                const rows = Number(inputs.rows ?? 2);
                const columns = Number(inputs.columns ?? 2);
                const index = Number(inputs.index ?? 1);
                if (!documentId) throw new Error('documentId is required.');
                const data = await gdocs('POST', `/documents/${documentId}:batchUpdate`, {
                    requests: [{ insertTable: { rows, columns, location: { index } } }],
                });
                return { output: { documentId } };
            }

            case 'createFromTemplate': {
                const templateId = String(inputs.templateId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                const replacements = inputs.replacements;
                if (!templateId) throw new Error('templateId is required.');
                // Copy the template using Drive API
                const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${templateId}/copy`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: title || `Copy of template` }),
                });
                const copyData = await copyRes.json();
                if (!copyRes.ok) throw new Error(copyData?.error?.message || 'Failed to copy template');
                const newDocId = copyData.id;
                // Apply replacements if provided
                if (replacements) {
                    const replacementsObj = typeof replacements === 'string' ? JSON.parse(replacements) : replacements;
                    const requests = Object.entries(replacementsObj).map(([search, replace]) => ({
                        replaceAllText: { containsText: { text: search, matchCase: true }, replaceText: String(replace) },
                    }));
                    await gdocs('POST', `/documents/${newDocId}:batchUpdate`, { requests });
                }
                return { output: { documentId: newDocId, title: title || `Copy of template` } };
            }

            default:
                return { error: `Google Docs action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Google Docs action failed.' };
    }
}

function extractTextFromBody(body: any): string {
    if (!body?.content) return '';
    const texts: string[] = [];
    for (const element of body.content) {
        if (element.paragraph?.elements) {
            for (const el of element.paragraph.elements) {
                if (el.textRun?.content) texts.push(el.textRun.content);
            }
        }
    }
    return texts.join('');
}

function getDocEndIndex(doc: any): number {
    const content = doc.body?.content ?? [];
    if (!content.length) return 1;
    const last = content[content.length - 1];
    return last.endIndex ?? 1;
}
