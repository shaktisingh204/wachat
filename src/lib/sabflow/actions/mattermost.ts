
'use server';

async function mattermostFetch(
    serverUrl: string,
    token: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const baseUrl = String(serverUrl).replace(/\/$/, '');
    const url = `${baseUrl}/api/v4${path}`;
    logger?.log(`[Mattermost] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Mattermost API error: ${res.status}`);
    }
    return data;
}

export async function executeMattermostAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        const token = String(inputs.token ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');
        if (!token) throw new Error('token is required.');

        const mm = (method: string, path: string, body?: any) =>
            mattermostFetch(serverUrl, token, method, path, body, logger);

        switch (actionName) {
            case 'postMessage': {
                const channelId = String(inputs.channelId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                if (!message) throw new Error('message is required.');

                const body: any = { channel_id: channelId, message };
                if (inputs.rootId) body.root_id = String(inputs.rootId);

                const data = await mm('POST', '/posts', body);
                logger.log(`[Mattermost] Posted to channel ${channelId}`);
                return { output: { id: data.id, message: data.message } };
            }

            case 'getChannel': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');

                const data = await mm('GET', `/channels/${channelId}`);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        displayName: data.display_name,
                        type: data.type,
                        teamId: data.team_id,
                    },
                };
            }

            case 'createChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const displayName = String(inputs.displayName ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');
                if (!name) throw new Error('name is required.');
                if (!displayName) throw new Error('displayName is required.');

                const type = String(inputs.type ?? 'O').trim(); // O = public, P = private
                const data = await mm('POST', '/channels', { team_id: teamId, name, display_name: displayName, type });
                return { output: { id: data.id, name: data.name, displayName: data.display_name } };
            }

            case 'listChannels': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');

                const data = await mm('GET', `/teams/${teamId}/channels?per_page=200`);
                const channels = Array.isArray(data) ? data : [];
                return { output: { channels, count: channels.length } };
            }

            case 'getUser': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');

                const data = await mm('GET', `/users/${userId}`);
                return { output: { id: data.id, username: data.username, email: data.email, firstName: data.first_name, lastName: data.last_name } };
            }

            case 'listUsers': {
                const data = await mm('GET', '/users?per_page=200');
                const users = Array.isArray(data) ? data : [];
                return { output: { users, count: users.length } };
            }

            case 'createTeam': {
                const name = String(inputs.name ?? '').trim();
                const displayName = String(inputs.displayName ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!displayName) throw new Error('displayName is required.');

                const type = String(inputs.type ?? 'I').trim(); // I = invite-only, O = open
                const data = await mm('POST', '/teams', { name, display_name: displayName, type });
                return { output: { id: data.id, name: data.name, displayName: data.display_name } };
            }

            case 'getTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                if (!teamId) throw new Error('teamId is required.');

                const data = await mm('GET', `/teams/${teamId}`);
                return { output: { id: data.id, name: data.name, displayName: data.display_name } };
            }

            case 'uploadFile': {
                const channelId = String(inputs.channelId ?? '').trim();
                const filename = String(inputs.filename ?? '').trim();
                const fileContent = String(inputs.fileContent ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');
                if (!filename) throw new Error('filename is required.');
                if (!fileContent) throw new Error('fileContent is required.');

                // Encode content as base64 buffer upload via multipart
                const boundary = `----sabflow${Date.now()}`;
                const fileBuffer = Buffer.from(fileContent, 'base64');
                const bodyParts = [
                    `--${boundary}\r\nContent-Disposition: form-data; name="channel_id"\r\n\r\n${channelId}`,
                    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
                ];
                const textPart = Buffer.from(bodyParts.join('\r\n'));
                const endBoundary = Buffer.from(`\r\n--${boundary}--`);
                const multipartBody = Buffer.concat([textPart, fileBuffer, endBoundary]);

                const baseUrl = String(serverUrl).replace(/\/$/, '');
                const res = await fetch(`${baseUrl}/api/v4/files`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    },
                    body: multipartBody,
                });
                const uploadData = await res.json();
                if (!res.ok) throw new Error(uploadData?.message || `File upload error: ${res.status}`);
                const fileId = uploadData?.file_infos?.[0]?.id ?? '';
                return { output: { fileId } };
            }

            case 'deletePost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');

                await mm('DELETE', `/posts/${postId}`);
                return { output: { deleted: true, postId } };
            }

            case 'getPost': {
                const postId = String(inputs.postId ?? '').trim();
                if (!postId) throw new Error('postId is required.');

                const data = await mm('GET', `/posts/${postId}`);
                return { output: { id: data.id, message: data.message, channelId: data.channel_id, userId: data.user_id } };
            }

            case 'updatePost': {
                const postId = String(inputs.postId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!postId) throw new Error('postId is required.');
                if (!message) throw new Error('message is required.');

                const data = await mm('PUT', `/posts/${postId}`, { id: postId, message });
                return { output: { id: data.id, message: data.message } };
            }

            case 'listPosts': {
                const channelId = String(inputs.channelId ?? '').trim();
                if (!channelId) throw new Error('channelId is required.');

                const page = Number(inputs.page ?? 0);
                const perPage = Number(inputs.perPage ?? 60);
                const data = await mm('GET', `/channels/${channelId}/posts?page=${page}&per_page=${perPage}`);
                const posts = data.posts ? Object.values(data.posts) : [];
                return { output: { posts, order: data.order ?? [], count: posts.length } };
            }

            default:
                return { error: `Mattermost action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mattermost action failed.' };
    }
}
