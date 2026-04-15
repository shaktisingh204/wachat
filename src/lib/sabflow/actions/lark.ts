'use server';

export async function executeLarkAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { appId, appSecret, accessToken: directToken, feishu } = inputs;

        const base = feishu
            ? 'https://open.feishu.cn/open-apis'
            : 'https://open.larksuite.com/open-apis';

        // Resolve token: use direct accessToken if provided, otherwise fetch via app credentials
        let token: string;
        if (directToken) {
            token = directToken;
        } else {
            if (!appId) return { error: 'Lark: appId is required (or provide accessToken directly).' };
            if (!appSecret) return { error: 'Lark: appSecret is required (or provide accessToken directly).' };

            const authRes = await fetch(`${base}/auth/v3/app_access_token/internal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
            });
            const authData = await authRes.json();
            if (!authRes.ok || !authData.tenant_access_token) {
                throw new Error(authData?.msg || authData?.message || 'Lark: Failed to obtain access token.');
            }
            token = authData.tenant_access_token;
        }

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function get(path: string): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'GET', headers });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok || (data?.code && data.code !== 0)) {
                throw new Error(data?.msg || data?.message || JSON.stringify(data) || `Lark error: ${res.status}`);
            }
            return data;
        }

        async function post(path: string, body: any): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok || (data?.code && data.code !== 0)) {
                throw new Error(data?.msg || data?.message || JSON.stringify(data) || `Lark error: ${res.status}`);
            }
            return data;
        }

        logger.log(`Executing Lark action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendMessage': {
                const { receiveId, text, receiveIdType } = inputs;
                if (!receiveId) return { error: 'Lark sendMessage: receiveId is required.' };
                if (!text) return { error: 'Lark sendMessage: text is required.' };
                const qs = `?receive_id_type=${receiveIdType || 'user_id'}`;
                const data = await post(`/im/v1/messages${qs}`, {
                    receive_id: receiveId,
                    msg_type: 'text',
                    content: JSON.stringify({ text }),
                });
                return { output: data };
            }

            case 'sendRichMessage': {
                const { receiveId, content, receiveIdType } = inputs;
                if (!receiveId) return { error: 'Lark sendRichMessage: receiveId is required.' };
                if (!content) return { error: 'Lark sendRichMessage: content is required.' };
                const qs = `?receive_id_type=${receiveIdType || 'user_id'}`;
                const data = await post(`/im/v1/messages${qs}`, {
                    receive_id: receiveId,
                    msg_type: 'post',
                    content: typeof content === 'string' ? content : JSON.stringify(content),
                });
                return { output: data };
            }

            case 'sendCard': {
                const { receiveId, card, receiveIdType } = inputs;
                if (!receiveId) return { error: 'Lark sendCard: receiveId is required.' };
                if (!card) return { error: 'Lark sendCard: card is required.' };
                const qs = `?receive_id_type=${receiveIdType || 'user_id'}`;
                const data = await post(`/im/v1/messages${qs}`, {
                    receive_id: receiveId,
                    msg_type: 'interactive',
                    content: typeof card === 'string' ? card : JSON.stringify(card),
                });
                return { output: data };
            }

            case 'getUser': {
                const { userId, userIdType } = inputs;
                if (!userId) return { error: 'Lark getUser: userId is required.' };
                const qs = userIdType ? `?user_id_type=${userIdType}` : '';
                const data = await get(`/contact/v3/users/${userId}${qs}`);
                return { output: data?.data?.user || data };
            }

            case 'listUsers': {
                const { departmentId, pageSize, pageToken } = inputs;
                const qs = new URLSearchParams();
                if (departmentId) qs.set('department_id', departmentId);
                if (pageSize) qs.set('page_size', String(pageSize));
                if (pageToken) qs.set('page_token', pageToken);
                const data = await get(`/contact/v3/users${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data?.data || data };
            }

            case 'listChats': {
                const { pageSize, pageToken } = inputs;
                const qs = new URLSearchParams();
                if (pageSize) qs.set('page_size', String(pageSize));
                if (pageToken) qs.set('page_token', pageToken);
                const data = await get(`/im/v1/chats${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data?.data || data };
            }

            case 'getChat': {
                const { chatId } = inputs;
                if (!chatId) return { error: 'Lark getChat: chatId is required.' };
                const data = await get(`/im/v1/chats/${chatId}`);
                return { output: data?.data || data };
            }

            case 'createChat': {
                const { name, description, ownerId, memberUserIds } = inputs;
                if (!name) return { error: 'Lark createChat: name is required.' };
                const data = await post('/im/v1/chats', {
                    name,
                    description,
                    owner_id: ownerId,
                    user_id_list: memberUserIds,
                });
                return { output: data?.data || data };
            }

            case 'addChatMembers': {
                const { chatId, userIds } = inputs;
                if (!chatId) return { error: 'Lark addChatMembers: chatId is required.' };
                if (!userIds) return { error: 'Lark addChatMembers: userIds is required.' };
                const data = await post(`/im/v1/chats/${chatId}/members`, {
                    id_list: Array.isArray(userIds) ? userIds : [userIds],
                });
                return { output: data?.data || data };
            }

            case 'listCalendars': {
                const { pageSize, pageToken } = inputs;
                const qs = new URLSearchParams();
                if (pageSize) qs.set('page_size', String(pageSize));
                if (pageToken) qs.set('page_token', pageToken);
                const data = await get(`/calendar/v4/calendars${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data?.data || data };
            }

            case 'createEvent': {
                const { calendarId, summary, startTime, endTime, description, attendees } = inputs;
                if (!calendarId) return { error: 'Lark createEvent: calendarId is required.' };
                if (!summary) return { error: 'Lark createEvent: summary is required.' };
                if (!startTime) return { error: 'Lark createEvent: startTime is required.' };
                if (!endTime) return { error: 'Lark createEvent: endTime is required.' };
                const data = await post(`/calendar/v4/calendars/${calendarId}/events`, {
                    summary,
                    description,
                    start_time: startTime,
                    end_time: endTime,
                    attendee_ability: attendees ? 'can_invite_others' : 'none',
                });
                return { output: data?.data || data };
            }

            case 'getEvent': {
                const { calendarId, eventId } = inputs;
                if (!calendarId) return { error: 'Lark getEvent: calendarId is required.' };
                if (!eventId) return { error: 'Lark getEvent: eventId is required.' };
                const data = await get(`/calendar/v4/calendars/${calendarId}/events/${eventId}`);
                return { output: data?.data || data };
            }

            case 'listDriveFiles': {
                const { folderId, pageSize, pageToken } = inputs;
                const qs = new URLSearchParams();
                if (folderId) qs.set('folder_token', folderId);
                if (pageSize) qs.set('page_size', String(pageSize));
                if (pageToken) qs.set('page_token', pageToken);
                const data = await get(`/drive/v1/files${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data?.data || data };
            }

            case 'uploadDriveFile': {
                const { fileName, parentType, parentNodeToken, size, fileContent } = inputs;
                if (!fileName) return { error: 'Lark uploadDriveFile: fileName is required.' };
                if (!fileContent) return { error: 'Lark uploadDriveFile: fileContent is required.' };
                const data = await post('/drive/v1/files/upload_all', {
                    file_name: fileName,
                    parent_type: parentType || 'explorer',
                    parent_node: parentNodeToken,
                    size: size || fileContent.length,
                    file: fileContent,
                });
                return { output: data?.data || data };
            }

            case 'listTasks': {
                const { pageSize, pageToken } = inputs;
                const qs = new URLSearchParams();
                if (pageSize) qs.set('page_size', String(pageSize));
                if (pageToken) qs.set('page_token', pageToken);
                const data = await get(`/task/v1/tasks${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data?.data || data };
            }

            default:
                return { error: `Lark: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Lark action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Lark: An unexpected error occurred.' };
    }
}
