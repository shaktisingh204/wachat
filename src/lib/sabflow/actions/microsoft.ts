
'use server';

const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Microsoft] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${MS_GRAPH_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.message || `Microsoft Graph error: ${res.status}`);
    return data;
}

export async function executeMicrosoftAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const graph = (method: string, path: string, body?: any) => graphFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getProfile': {
                const data = await graph('GET', '/me');
                return { output: { id: data.id, displayName: data.displayName, email: data.mail ?? data.userPrincipalName, jobTitle: data.jobTitle } };
            }

            case 'sendEmail': {
                const toEmail = String(inputs.toEmail ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const bodyType = String(inputs.bodyType ?? 'HTML');
                const ccEmail = inputs.ccEmail ? String(inputs.ccEmail).trim() : undefined;
                if (!toEmail || !subject || !body) throw new Error('toEmail, subject, and body are required.');
                const message: any = {
                    subject,
                    body: { contentType: bodyType, content: body },
                    toRecipients: [{ emailAddress: { address: toEmail } }],
                };
                if (ccEmail) message.ccRecipients = [{ emailAddress: { address: ccEmail } }];
                await graph('POST', '/me/sendMail', { message });
                return { output: { success: true, to: toEmail, subject } };
            }

            case 'listEmails': {
                const folderId = String(inputs.folderId ?? 'inbox');
                const top = Number(inputs.top ?? 20);
                const filter = inputs.filter ? String(inputs.filter).trim() : undefined;
                let path = `/me/mailFolders/${folderId}/messages?$top=${top}&$orderby=receivedDateTime desc`;
                if (filter) path += `&$filter=${encodeURIComponent(filter)}`;
                const data = await graph('GET', path);
                return { output: { messages: data.value ?? [], total: data['@odata.count'] ?? (data.value?.length ?? 0) } };
            }

            case 'getEmail': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const data = await graph('GET', `/me/messages/${messageId}`);
                return { output: { id: data.id, subject: data.subject, from: data.from?.emailAddress, body: data.body?.content, receivedAt: data.receivedDateTime } };
            }

            case 'createCalendarEvent': {
                const subject = String(inputs.subject ?? '').trim();
                const start = String(inputs.start ?? '').trim();
                const end = String(inputs.end ?? '').trim();
                const bodyContent = inputs.body ? String(inputs.body).trim() : undefined;
                const isOnlineMeeting = inputs.isOnlineMeeting === true || inputs.isOnlineMeeting === 'true';
                if (!subject || !start || !end) throw new Error('subject, start, and end are required.');
                let attendees: any[] = [];
                if (inputs.attendees) {
                    const raw = typeof inputs.attendees === 'string' ? JSON.parse(inputs.attendees) : inputs.attendees;
                    attendees = Array.isArray(raw) ? raw.map((a: any) => ({
                        emailAddress: { address: typeof a === 'string' ? a : a.email ?? a.address },
                        type: 'required',
                    })) : [];
                }
                const event: any = {
                    subject,
                    start: { dateTime: start, timeZone: 'UTC' },
                    end: { dateTime: end, timeZone: 'UTC' },
                    isOnlineMeeting,
                };
                if (bodyContent) event.body = { contentType: 'HTML', content: bodyContent };
                if (attendees.length > 0) event.attendees = attendees;
                const data = await graph('POST', '/me/events', event);
                return { output: { id: data.id, subject: data.subject, start: data.start, end: data.end, webLink: data.webLink, onlineMeeting: data.onlineMeeting ?? null } };
            }

            case 'listCalendarEvents': {
                const startDateTime = String(inputs.startDateTime ?? '').trim();
                const endDateTime = String(inputs.endDateTime ?? '').trim();
                if (!startDateTime || !endDateTime) throw new Error('startDateTime and endDateTime are required.');
                const path = `/me/calendarView?startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}&$orderby=start/dateTime`;
                const data = await graph('GET', path);
                return { output: { events: data.value ?? [] } };
            }

            case 'listTeams': {
                const data = await graph('GET', '/me/joinedTeams');
                return { output: { teams: data.value ?? [] } };
            }

            case 'sendTeamsMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!teamId || !channelId || !message) throw new Error('teamId, channelId, and message are required.');
                const data = await graph('POST', `/teams/${teamId}/channels/${channelId}/messages`, {
                    body: { contentType: 'html', content: message },
                });
                return { output: { id: data.id, createdAt: data.createdDateTime, webUrl: data.webUrl } };
            }

            case 'listChannels': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                const data = await graph('GET', `/teams/${teamId}/channels`);
                return { output: { channels: data.value ?? [] } };
            }

            case 'listOneDriveFiles': {
                const itemPath = String(inputs.itemPath ?? '/').trim();
                let path: string;
                if (itemPath === '/' || itemPath === '') {
                    path = '/me/drive/root/children';
                } else {
                    const cleanPath = itemPath.startsWith('/') ? itemPath.slice(1) : itemPath;
                    path = `/me/drive/root:/${cleanPath}:/children`;
                }
                const data = await graph('GET', path);
                return { output: { files: data.value ?? [] } };
            }

            case 'uploadOneDriveFile': {
                const fileName = String(inputs.fileName ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const folderPath = String(inputs.folderPath ?? '/').trim();
                if (!fileName || !fileUrl) throw new Error('fileName and fileUrl are required.');
                logger?.log(`[Microsoft] Fetching source file: ${fileUrl}`);
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to fetch fileUrl: ${fileRes.status}`);
                const fileBytes = await fileRes.arrayBuffer();
                const contentType = fileRes.headers.get('content-type') ?? 'application/octet-stream';
                const cleanFolder = folderPath === '/' || folderPath === '' ? '' : (folderPath.startsWith('/') ? folderPath : `/${folderPath}`);
                const uploadPath = `/me/drive/root:${cleanFolder}/${fileName}:/content`;
                logger?.log(`[Microsoft] PUT ${uploadPath}`);
                const res = await fetch(`${MS_GRAPH_BASE}${uploadPath}`, {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': contentType,
                    },
                    body: fileBytes,
                });
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = { raw: text }; }
                if (!res.ok) throw new Error(data?.error?.message || `OneDrive upload error: ${res.status}`);
                return { output: { id: data.id, name: data.name, size: data.size, webUrl: data.webUrl } };
            }

            case 'getExcelRange': {
                const workbookId = String(inputs.workbookId ?? '').trim();
                const sheetName = String(inputs.sheetName ?? '').trim();
                const range = String(inputs.range ?? '').trim();
                if (!workbookId || !sheetName || !range) throw new Error('workbookId, sheetName, and range are required.');
                const path = `/me/drive/items/${workbookId}/workbook/worksheets/${sheetName}/range(address='${range}')`;
                const data = await graph('GET', path);
                return { output: { values: data.values ?? [], address: data.address, rowCount: data.rowCount, columnCount: data.columnCount } };
            }

            case 'updateExcelRange': {
                const workbookId = String(inputs.workbookId ?? '').trim();
                const sheetName = String(inputs.sheetName ?? '').trim();
                const range = String(inputs.range ?? '').trim();
                if (!workbookId || !sheetName || !range) throw new Error('workbookId, sheetName, and range are required.');
                const values = typeof inputs.values === 'string' ? JSON.parse(inputs.values) : inputs.values;
                if (!Array.isArray(values)) throw new Error('values must be a 2D array.');
                const path = `/me/drive/items/${workbookId}/workbook/worksheets/${sheetName}/range(address='${range}')`;
                const data = await graph('PATCH', path, { values });
                return { output: { address: data.address, rowCount: data.rowCount, columnCount: data.columnCount } };
            }

            case 'createSharePointList': {
                const siteId = String(inputs.siteId ?? '').trim();
                const displayName = String(inputs.displayName ?? '').trim();
                if (!siteId || !displayName) throw new Error('siteId and displayName are required.');
                const columns = inputs.columns ? (typeof inputs.columns === 'string' ? JSON.parse(inputs.columns) : inputs.columns) : undefined;
                const body: any = { displayName, list: {} };
                if (columns) body.columns = columns;
                const data = await graph('POST', `/sites/${siteId}/lists`, body);
                return { output: { id: data.id, displayName: data.displayName, webUrl: data.webUrl } };
            }

            case 'listSharePointItems': {
                const siteId = String(inputs.siteId ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!siteId || !listId) throw new Error('siteId and listId are required.');
                const data = await graph('GET', `/sites/${siteId}/lists/${listId}/items?expand=fields`);
                return { output: { items: data.value ?? [], total: data['@odata.count'] ?? (data.value?.length ?? 0) } };
            }

            default:
                throw new Error(`Unknown Microsoft action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
