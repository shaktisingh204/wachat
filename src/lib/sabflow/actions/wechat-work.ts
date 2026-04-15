'use server';

export async function executeWechatWorkAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        // Get access token
        const tokenRes = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${inputs.corpId}&corpsecret=${inputs.corpSecret}`);
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            return { error: `WeCom auth failed: ${tokenData.errmsg || 'unknown error'}` };
        }
        const token = tokenData.access_token;
        const baseUrl = 'https://qyapi.weixin.qq.com/cgi-bin';

        const get = (path: string) =>
            fetch(`${baseUrl}${path}&access_token=${token}`, { method: 'GET' }).then(r => r.json());

        const post = (path: string, body: any) =>
            fetch(`${baseUrl}${path}?access_token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(r => r.json());

        switch (actionName) {
            case 'sendMessage': {
                const data = await post('/message/send', {
                    touser: inputs.toUser,
                    toparty: inputs.toParty,
                    totag: inputs.toTag,
                    msgtype: inputs.msgtype || 'text',
                    agentid: inputs.agentId,
                    text: { content: inputs.content },
                    safe: inputs.safe || 0,
                });
                return { output: data };
            }

            case 'sendTextMessage': {
                const data = await post('/message/send', {
                    touser: inputs.toUser,
                    msgtype: 'text',
                    agentid: inputs.agentId,
                    text: { content: inputs.content },
                });
                return { output: data };
            }

            case 'sendMarkdown': {
                const data = await post('/message/send', {
                    touser: inputs.toUser,
                    msgtype: 'markdown',
                    agentid: inputs.agentId,
                    markdown: { content: inputs.content },
                });
                return { output: data };
            }

            case 'sendCard': {
                const data = await post('/message/send', {
                    touser: inputs.toUser,
                    msgtype: 'textcard',
                    agentid: inputs.agentId,
                    textcard: {
                        title: inputs.title,
                        description: inputs.description,
                        url: inputs.url,
                        btntxt: inputs.btnText || 'Details',
                    },
                });
                return { output: data };
            }

            case 'getUser': {
                const data = await get(`/user/get?userid=${inputs.userId}`);
                return { output: data };
            }

            case 'listUsers': {
                const data = await get(`/user/list?department_id=${inputs.departmentId || 1}&fetch_child=${inputs.fetchChild ? 1 : 0}`);
                return { output: data };
            }

            case 'getDepartment': {
                const data = await get(`/department/get?id=${inputs.departmentId}`);
                return { output: data };
            }

            case 'listDepartments': {
                const data = await get(`/department/list?${inputs.id ? `id=${inputs.id}` : ''}`);
                return { output: data };
            }

            case 'createUser': {
                const data = await post('/user/create', {
                    userid: inputs.userId,
                    name: inputs.name,
                    mobile: inputs.mobile,
                    department: inputs.department || [1],
                    email: inputs.email,
                    title: inputs.title,
                    telephone: inputs.telephone,
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

            case 'getTag': {
                const data = await get(`/tag/get?tagid=${inputs.tagId}`);
                return { output: data };
            }

            case 'listTags': {
                const data = await get('/tag/list?');
                return { output: data };
            }

            case 'createGroup': {
                const data = await post('/appchat/create', {
                    name: inputs.name,
                    owner: inputs.owner,
                    userlist: inputs.userList || [],
                    chatid: inputs.chatId,
                });
                return { output: data };
            }

            case 'sendGroupMessage': {
                const data = await post('/appchat/send', {
                    chatid: inputs.chatId,
                    msgtype: inputs.msgtype || 'text',
                    text: { content: inputs.content },
                    safe: inputs.safe || 0,
                });
                return { output: data };
            }

            default:
                return { error: `WeCom action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'WeCom action failed with an unknown error.' };
    }
}
