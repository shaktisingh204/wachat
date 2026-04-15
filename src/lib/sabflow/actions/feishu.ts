'use server';

export async function executeFeishuAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        // Get tenant access token
        const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_id: inputs.appId, app_secret: inputs.appSecret }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.tenant_access_token) {
            return { error: `Feishu auth failed: ${tokenData.msg || 'unknown error'}` };
        }
        const token = tokenData.tenant_access_token;
        const baseUrl = 'https://open.feishu.cn/open-apis';
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/im/v1/messages?receive_id_type=${inputs.receiveIdType || 'open_id'}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        receive_id: inputs.receiveId,
                        msg_type: inputs.msgType || 'text',
                        content: inputs.content,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'sendGroupMessage': {
                const res = await fetch(`${baseUrl}/im/v1/messages?receive_id_type=chat_id`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        receive_id: inputs.chatId,
                        msg_type: inputs.msgType || 'text',
                        content: inputs.content,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'createGroup': {
                const res = await fetch(`${baseUrl}/im/v1/chats`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        user_id_list: inputs.userIdList || [],
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listGroupMembers': {
                const res = await fetch(`${baseUrl}/im/v1/chats/${inputs.chatId}/members?member_id_type=${inputs.memberIdType || 'open_id'}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'addGroupMember': {
                const res = await fetch(`${baseUrl}/im/v1/chats/${inputs.chatId}/members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        member_id_type: inputs.memberIdType || 'open_id',
                        id_list: inputs.idList || [],
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/contact/v3/users/${inputs.userId}?user_id_type=${inputs.userIdType || 'open_id'}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listUsers': {
                const params = new URLSearchParams({
                    department_id: inputs.departmentId || '0',
                    user_id_type: inputs.userIdType || 'open_id',
                    page_size: String(inputs.pageSize || 50),
                    ...(inputs.pageToken ? { page_token: inputs.pageToken } : {}),
                });
                const res = await fetch(`${baseUrl}/contact/v3/users?${params}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'createUser': {
                const res = await fetch(`${baseUrl}/contact/v3/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        user_id: inputs.userId,
                        name: inputs.name,
                        en_name: inputs.enName,
                        email: inputs.email,
                        mobile: inputs.mobile,
                        department_id_list: inputs.departmentIdList || [],
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'updateUser': {
                const res = await fetch(`${baseUrl}/contact/v3/users/${inputs.userId}?user_id_type=${inputs.userIdType || 'open_id'}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.fields || {}),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'uploadFile': {
                const res = await fetch(`${baseUrl}/im/v1/files`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        file_type: inputs.fileType || 'stream',
                        file_name: inputs.fileName,
                        duration: inputs.duration,
                        data: inputs.data,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'downloadFile': {
                const res = await fetch(`${baseUrl}/im/v1/files/${inputs.fileKey}`, {
                    method: 'GET',
                    headers,
                });
                if (!res.ok) {
                    return { error: `Feishu downloadFile failed: ${res.status} ${res.statusText}` };
                }
                return { output: { fileKey: inputs.fileKey, status: 'downloaded', contentType: res.headers.get('content-type') } };
            }

            case 'createCalendarEvent': {
                const res = await fetch(`${baseUrl}/calendar/v4/calendars/${inputs.calendarId}/events`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        summary: inputs.summary,
                        description: inputs.description,
                        start_time: { timestamp: inputs.startTime },
                        end_time: { timestamp: inputs.endTime },
                        attendee_ability: inputs.attendeeAbility || 'none',
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listCalendarEvents': {
                const params = new URLSearchParams({
                    start_time: inputs.startTime || '',
                    end_time: inputs.endTime || '',
                    page_size: String(inputs.pageSize || 50),
                    ...(inputs.pageToken ? { page_token: inputs.pageToken } : {}),
                });
                const res = await fetch(`${baseUrl}/calendar/v4/calendars/${inputs.calendarId}/events?${params}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'createTask': {
                const res = await fetch(`${baseUrl}/task/v1/tasks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        summary: inputs.summary,
                        description: inputs.description,
                        due: inputs.due ? { timestamp: inputs.due } : undefined,
                        origin: { platform_i18n_name: inputs.platformName || 'SabFlow', href: { url: inputs.originUrl || '', title: inputs.originTitle || '' } },
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listTasks': {
                const params = new URLSearchParams({
                    page_size: String(inputs.pageSize || 50),
                    ...(inputs.pageToken ? { page_token: inputs.pageToken } : {}),
                });
                const res = await fetch(`${baseUrl}/task/v1/tasks?${params}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Feishu action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'Feishu action failed with an unknown error.' };
    }
}
