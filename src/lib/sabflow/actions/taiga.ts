
'use server';

const TAIGA_DEFAULT_SERVER = 'https://api.taiga.io';

async function taigaRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    serverUrl: string,
    path: string,
    authToken: string,
    body?: any,
    queryParams?: Record<string, string | number | undefined>
): Promise<any> {
    const base = `${serverUrl.replace(/\/$/, '')}/api/v1`;
    let url = `${base}${path}`;

    if (queryParams) {
        const filtered = Object.entries(queryParams).filter(
            ([, v]) => v !== undefined && v !== null && v !== ''
        );
        if (filtered.length > 0) {
            url += '?' + filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        }
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let errMsg = `Taiga API error ${res.status}`;
        try {
            const errBody = await res.json();
            errMsg = errBody._error_message || errBody.detail || JSON.stringify(errBody) || errMsg;
        } catch {
            errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
    }

    if (res.status === 204) return {};
    return res.json();
}

export async function executeTaigaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const serverUrl = String(inputs.serverUrl ?? TAIGA_DEFAULT_SERVER).trim();

        let authToken = String(inputs.authToken ?? '').trim();

        // Authenticate if no authToken provided (for non-login actions)
        if (!authToken && actionName !== 'login') {
            const username = String(inputs.username ?? '').trim();
            const password = String(inputs.password ?? '').trim();
            if (!username || !password) {
                throw new Error('Either authToken or username+password are required.');
            }
            const loginRes = await taigaRequest('POST', serverUrl, '/auth', '', {
                type: 'normal',
                username,
                password,
            });
            authToken = loginRes.auth_token;
            logger.log('[Taiga] Authenticated successfully.');
        }

        switch (actionName) {
            case 'login': {
                const username = String(inputs.username ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!username) throw new Error('username is required.');
                if (!password) throw new Error('password is required.');
                const data = await taigaRequest('POST', serverUrl, '/auth', '', {
                    type: 'normal',
                    username,
                    password,
                });
                logger.log(`[Taiga] Logged in as ${data.username}`);
                return {
                    output: {
                        authToken: data.auth_token,
                        id: data.id,
                        username: data.username,
                        fullName: data.full_name,
                    },
                };
            }

            case 'listProjects': {
                const userId = inputs.userId ? String(inputs.userId) : undefined;
                const data = await taigaRequest('GET', serverUrl, '/projects', authToken, undefined,
                    userId ? { member: userId } : undefined
                );
                const projects = (Array.isArray(data) ? data : []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug,
                    isFan: p.is_fan,
                    totalStoriesPoints: p.total_story_points,
                }));
                return { output: { projects } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await taigaRequest('GET', serverUrl, `/projects/${projectId}`, authToken);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        totalStories: data.total_userstories,
                        totalIssues: data.total_issues,
                        members: data.members ?? [],
                    },
                };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = {
                    name,
                    is_private: inputs.isPrivate === true || inputs.isPrivate === 'true' ? true : false,
                };
                if (inputs.description) body.description = String(inputs.description);
                const data = await taigaRequest('POST', serverUrl, '/projects', authToken, body);
                logger.log(`[Taiga] Created project ${data.id}`);
                return { output: { id: data.id, name: data.name, slug: data.slug } };
            }

            case 'listUserStories': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const params: Record<string, string | number | undefined> = { project: projectId };
                if (inputs.statusId) params.status = String(inputs.statusId);
                if (inputs.milestone) params.milestone = String(inputs.milestone);
                const data = await taigaRequest('GET', serverUrl, '/userstories', authToken, undefined, params);
                const userStories = (Array.isArray(data) ? data : []).map((s: any) => ({
                    id: s.id,
                    subject: s.subject,
                    status: s.status,
                    points: s.points,
                    assignedTo: s.assigned_to,
                }));
                return { output: { userStories } };
            }

            case 'getUserStory': {
                const storyId = String(inputs.storyId ?? '').trim();
                if (!storyId) throw new Error('storyId is required.');
                const data = await taigaRequest('GET', serverUrl, `/userstories/${storyId}`, authToken);
                return {
                    output: {
                        id: data.id,
                        subject: data.subject,
                        description: data.description,
                        status: data.status,
                        assignedTo: data.assigned_to,
                        tags: data.tags ?? [],
                    },
                };
            }

            case 'createUserStory': {
                const projectId = String(inputs.projectId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!subject) throw new Error('subject is required.');
                const body: Record<string, any> = { project: projectId, subject };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.statusId) body.status = inputs.statusId;
                if (inputs.points) body.points = inputs.points;
                if (inputs.assignedToId) body.assigned_to = inputs.assignedToId;
                const data = await taigaRequest('POST', serverUrl, '/userstories', authToken, body);
                logger.log(`[Taiga] Created user story ${data.id}`);
                return { output: { id: data.id, subject: data.subject } };
            }

            case 'updateUserStory': {
                const storyId = String(inputs.storyId ?? '').trim();
                if (!storyId) throw new Error('storyId is required.');
                const body: Record<string, any> = {};
                if (inputs.subject !== undefined && inputs.subject !== '') body.subject = String(inputs.subject);
                if (inputs.description !== undefined && inputs.description !== '') body.description = String(inputs.description);
                if (inputs.statusId !== undefined && inputs.statusId !== '') body.status = inputs.statusId;
                if (Object.keys(body).length === 0) throw new Error('At least one field to update is required.');
                const data = await taigaRequest('PATCH', serverUrl, `/userstories/${storyId}`, authToken, body);
                return { output: { id: data.id } };
            }

            case 'listIssues': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const params: Record<string, string | number | undefined> = { project: projectId };
                if (inputs.statusId) params.status = String(inputs.statusId);
                if (inputs.priority) params.priority = String(inputs.priority);
                if (inputs.severity) params.severity = String(inputs.severity);
                if (inputs.assignedTo) params.assigned_to = String(inputs.assignedTo);
                const data = await taigaRequest('GET', serverUrl, '/issues', authToken, undefined, params);
                const issues = (Array.isArray(data) ? data : []).map((i: any) => ({
                    id: i.id,
                    subject: i.subject,
                    status: i.status,
                    priority: i.priority,
                    severity: i.severity,
                }));
                return { output: { issues } };
            }

            case 'createIssue': {
                const projectId = String(inputs.projectId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!subject) throw new Error('subject is required.');
                const body: Record<string, any> = { project: projectId, subject };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.priority) body.priority = inputs.priority;
                if (inputs.severity) body.severity = inputs.severity;
                if (inputs.statusId) body.status = inputs.statusId;
                if (inputs.type) body.type = inputs.type;
                if (inputs.assignedTo) body.assigned_to = inputs.assignedTo;
                const data = await taigaRequest('POST', serverUrl, '/issues', authToken, body);
                logger.log(`[Taiga] Created issue ${data.id}`);
                return { output: { id: data.id, ref: data.ref, subject: data.subject } };
            }

            case 'listTasks': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const params: Record<string, string | number | undefined> = { project: projectId };
                if (inputs.userStoryId) params.user_story = String(inputs.userStoryId);
                const data = await taigaRequest('GET', serverUrl, '/tasks', authToken, undefined, params);
                const tasks = (Array.isArray(data) ? data : []).map((t: any) => ({
                    id: t.id,
                    subject: t.subject,
                    status: t.status,
                    assignedTo: t.assigned_to,
                }));
                return { output: { tasks } };
            }

            case 'createTask': {
                const projectId = String(inputs.projectId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!subject) throw new Error('subject is required.');
                const body: Record<string, any> = { project: projectId, subject };
                if (inputs.userStoryId) body.user_story = inputs.userStoryId;
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.assignedTo) body.assigned_to = inputs.assignedTo;
                const data = await taigaRequest('POST', serverUrl, '/tasks', authToken, body);
                logger.log(`[Taiga] Created task ${data.id}`);
                return { output: { id: data.id, ref: data.ref, subject: data.subject } };
            }

            case 'listSprints': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await taigaRequest('GET', serverUrl, '/milestones', authToken, undefined, { project: projectId });
                const milestones = (Array.isArray(data) ? data : []).map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    estimatedStart: m.estimated_start,
                    estimatedFinish: m.estimated_finish,
                    closed: m.closed,
                }));
                return { output: { milestones } };
            }

            case 'createSprint': {
                const projectId = String(inputs.projectId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const estimatedStart = String(inputs.estimatedStart ?? '').trim();
                const estimatedFinish = String(inputs.estimatedFinish ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                if (!name) throw new Error('name is required.');
                if (!estimatedStart) throw new Error('estimatedStart is required.');
                if (!estimatedFinish) throw new Error('estimatedFinish is required.');
                const data = await taigaRequest('POST', serverUrl, '/milestones', authToken, {
                    project: projectId,
                    name,
                    estimated_start: estimatedStart,
                    estimated_finish: estimatedFinish,
                });
                logger.log(`[Taiga] Created sprint ${data.id}`);
                return { output: { id: data.id, name: data.name } };
            }

            default:
                return { error: `Taiga action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger.log(`[Taiga] Error in action "${actionName}": ${e.message}`);
        return { error: e.message || 'Taiga action failed.' };
    }
}
