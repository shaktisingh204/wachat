'use server';

export async function executeDingTalkAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        // Get access token
        const tokenRes = await fetch(`https://oapi.dingtalk.com/gettoken?appkey=${inputs.appKey}&appsecret=${inputs.appSecret}`);
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            return { error: `DingTalk auth failed: ${tokenData.errmsg || 'unknown error'}` };
        }
        const token = tokenData.access_token;
        const baseUrl = 'https://oapi.dingtalk.com';

        const get = (path: string) =>
            fetch(`${baseUrl}${path}&access_token=${token}`, { method: 'GET' }).then(r => r.json());

        const post = (path: string, body: any) =>
            fetch(`${baseUrl}${path}?access_token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(r => r.json());

        switch (actionName) {
            case 'sendRobotMessage': {
                const res = await fetch(inputs.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        msgtype: inputs.msgtype || 'text',
                        text: { content: inputs.content },
                        at: { atMobiles: inputs.atMobiles || [], isAtAll: inputs.isAtAll || false },
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'sendGroupMessage': {
                const data = await post('/message/send_to_conversation', {
                    receiver: inputs.receiver,
                    sender: inputs.sender,
                    msg: { msgtype: inputs.msgtype || 'text', text: { content: inputs.content } },
                });
                return { output: data };
            }

            case 'createGroup': {
                const data = await post('/chat/create', {
                    name: inputs.name,
                    owner: inputs.owner,
                    useridlist: inputs.useridlist || [],
                });
                return { output: data };
            }

            case 'listDepartments': {
                const data = await get(`/department/list?id=${inputs.parentId || 1}`);
                return { output: data };
            }

            case 'getDepartment': {
                const data = await get(`/department/get?id=${inputs.departmentId}`);
                return { output: data };
            }

            case 'createDepartment': {
                const data = await post('/department/create', {
                    name: inputs.name,
                    parentid: inputs.parentId || 1,
                    order: inputs.order,
                    source_identifier: inputs.sourceIdentifier,
                });
                return { output: data };
            }

            case 'listUsers': {
                const data = await get(`/user/list?department_id=${inputs.departmentId || 1}&offset=${inputs.offset || 0}&size=${inputs.size || 100}`);
                return { output: data };
            }

            case 'getUser': {
                const data = await get(`/user/get?userid=${inputs.userId}`);
                return { output: data };
            }

            case 'createUser': {
                const data = await post('/user/create', {
                    userid: inputs.userId,
                    name: inputs.name,
                    mobile: inputs.mobile,
                    department: inputs.department || [1],
                    email: inputs.email,
                    jobnumber: inputs.jobNumber,
                    title: inputs.title,
                });
                return { output: data };
            }

            case 'updateUser': {
                const data = await post('/user/update', {
                    userid: inputs.userId,
                    name: inputs.name,
                    mobile: inputs.mobile,
                    email: inputs.email,
                    ...(inputs.fields || {}),
                });
                return { output: data };
            }

            case 'deleteUser': {
                const data = await get(`/user/delete?userid=${inputs.userId}`);
                return { output: data };
            }

            case 'listAttendance': {
                const data = await post('/attendance/list', {
                    workDateFrom: inputs.workDateFrom,
                    workDateTo: inputs.workDateTo,
                    userIdList: inputs.userIdList || [],
                    offset: inputs.offset || 0,
                    limit: inputs.limit || 50,
                });
                return { output: data };
            }

            case 'getAttendance': {
                const data = await post('/attendance/getAttendanceResult', {
                    userId: inputs.userId,
                    workDate: inputs.workDate,
                });
                return { output: data };
            }

            case 'sendOA': {
                const data = await post('/topapi/message/corpconversation/asyncsend_v2', {
                    agent_id: inputs.agentId,
                    userid_list: inputs.useridList,
                    to_all_user: inputs.toAllUser || false,
                    msg: {
                        msgtype: 'oa',
                        oa: {
                            message_url: inputs.messageUrl,
                            head: { bgcolor: inputs.headBgcolor || 'FFBBBBBB', text: inputs.headText },
                            body: { title: inputs.bodyTitle, content: inputs.bodyContent },
                        },
                    },
                });
                return { output: data };
            }

            case 'createCalendarEvent': {
                const data = await post('/calendar/v2/create', {
                    summary: inputs.summary,
                    description: inputs.description,
                    start: { dateTime: inputs.startTime },
                    end: { dateTime: inputs.endTime },
                    attendees: inputs.attendees || [],
                });
                return { output: data };
            }

            default:
                return { error: `DingTalk action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'DingTalk action failed with an unknown error.' };
    }
}
