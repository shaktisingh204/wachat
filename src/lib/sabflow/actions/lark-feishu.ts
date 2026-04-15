'use server';

export async function executeLarkFeishuAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://open.larksuite.com/open-apis';

        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/im/v1/messages?receive_id_type=${inputs.receiveIdType || 'open_id'}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        receive_id: inputs.receiveId,
                        msg_type: inputs.msgType || 'text',
                        content: typeof inputs.content === 'string' ? inputs.content : JSON.stringify(inputs.content),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { message: data.data } };
            }

            case 'sendDirectMessage': {
                const res = await fetch(`${baseUrl}/im/v1/messages?receive_id_type=user_id`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        receive_id: inputs.userId,
                        msg_type: inputs.msgType || 'text',
                        content: typeof inputs.content === 'string' ? inputs.content : JSON.stringify(inputs.content),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { message: data.data } };
            }

            case 'createGroup': {
                const res = await fetch(`${baseUrl}/im/v1/chats`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        user_ids: inputs.userIds || [],
                        open_ids: inputs.openIds || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { group: data.data } };
            }

            case 'listGroups': {
                const params = new URLSearchParams({ page_size: String(inputs.pageSize || 20) });
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const res = await fetch(`${baseUrl}/im/v1/chats?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { groups: data.data?.items || [], hasMore: data.data?.has_more, pageToken: data.data?.page_token } };
            }

            case 'getGroupMembers': {
                const params = new URLSearchParams({ page_size: String(inputs.pageSize || 20) });
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const res = await fetch(`${baseUrl}/im/v1/chats/${inputs.chatId}/members?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { members: data.data?.items || [], hasMore: data.data?.has_more } };
            }

            case 'addGroupMember': {
                const res = await fetch(`${baseUrl}/im/v1/chats/${inputs.chatId}/members`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_list: inputs.idList || [],
                        member_id_type: inputs.memberIdType || 'open_id',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { result: data.data } };
            }

            case 'sendGroupMessage': {
                const res = await fetch(`${baseUrl}/im/v1/messages?receive_id_type=chat_id`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        receive_id: inputs.chatId,
                        msg_type: inputs.msgType || 'text',
                        content: typeof inputs.content === 'string' ? inputs.content : JSON.stringify(inputs.content),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { message: data.data } };
            }

            case 'listContacts': {
                const params = new URLSearchParams({ page_size: String(inputs.pageSize || 20) });
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                if (inputs.departmentId) params.set('department_id', inputs.departmentId);
                const res = await fetch(`${baseUrl}/contact/v3/users?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { contacts: data.data?.items || [], hasMore: data.data?.has_more } };
            }

            case 'getContact': {
                const res = await fetch(`${baseUrl}/contact/v3/users/${inputs.userId}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { contact: data.data?.user } };
            }

            case 'createCalendarEvent': {
                const res = await fetch(`${baseUrl}/calendar/v4/calendars/${inputs.calendarId}/events`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        summary: inputs.summary,
                        description: inputs.description,
                        start_time: { timestamp: inputs.startTime, timezone: inputs.timezone || 'UTC' },
                        end_time: { timestamp: inputs.endTime, timezone: inputs.timezone || 'UTC' },
                        attendee_ability: inputs.attendeeAbility || 'can_see_others',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { event: data.data?.event } };
            }

            case 'listCalendarEvents': {
                const params = new URLSearchParams({ page_size: String(inputs.pageSize || 20) });
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                if (inputs.startTime) params.set('start_time', inputs.startTime);
                if (inputs.endTime) params.set('end_time', inputs.endTime);
                const res = await fetch(`${baseUrl}/calendar/v4/calendars/${inputs.calendarId}/events?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { events: data.data?.items || [], hasMore: data.data?.has_more } };
            }

            case 'createTask': {
                const res = await fetch(`${baseUrl}/task/v1/tasks`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        summary: inputs.summary,
                        description: inputs.description,
                        due: inputs.due ? { time: inputs.due } : undefined,
                        collaborator_ids: inputs.collaboratorIds || [],
                        follower_ids: inputs.followerIds || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { task: data.data?.task } };
            }

            case 'listTasks': {
                const params = new URLSearchParams({ page_size: String(inputs.pageSize || 20) });
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                if (inputs.creatorId) params.set('creator_id', inputs.creatorId);
                const res = await fetch(`${baseUrl}/task/v1/tasks?${params}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { tasks: data.data?.items || [], hasMore: data.data?.has_more } };
            }

            case 'searchDocs': {
                const res = await fetch(`${baseUrl}/suite/docs-api/search/object`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: inputs.query,
                        obj_types: inputs.objTypes || ['doc', 'sheet', 'mindnote'],
                        count: inputs.count || 20,
                        offset: inputs.offset || 0,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { results: data.data?.entities || [] } };
            }

            case 'uploadFile': {
                const res = await fetch(`${baseUrl}/im/v1/files`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        file_type: inputs.fileType || 'stream',
                        file_name: inputs.fileName,
                        duration: inputs.duration,
                        data: inputs.data,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.msg || `API error: ${res.status}`);
                return { output: { fileKey: data.data?.file_key } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
