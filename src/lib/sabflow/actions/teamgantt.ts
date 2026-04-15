'use server';

export async function executeTeamGanttAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const username = inputs.username;
        const password = inputs.password;
        const baseUrl = 'https://api.teamgantt.com/v1';

        const base64Auth = Buffer.from(`${username}:${password}`).toString('base64');

        const headers: Record<string, string> = {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[TeamGantt] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`TeamGantt API error ${res.status}: ${text}`);
            }
            if (res.status === 204) return {};
            return res.json();
        };

        switch (actionName) {
            case 'listProjects': {
                const data = await req('GET', '/projects');
                return { output: { projects: data } };
            }
            case 'getProject': {
                const data = await req('GET', `/projects/${inputs.projectId}`);
                return { output: { project: data } };
            }
            case 'createProject': {
                const body: any = { name: inputs.name };
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                if (inputs.description) body.description = inputs.description;
                const data = await req('POST', '/projects', body);
                return { output: { project: data } };
            }
            case 'listTasks': {
                const data = await req('GET', `/projects/${inputs.projectId}/tasks`);
                return { output: { tasks: data } };
            }
            case 'getTask': {
                const data = await req('GET', `/tasks/${inputs.taskId}`);
                return { output: { task: data } };
            }
            case 'createTask': {
                const body: any = {
                    name: inputs.name,
                    project_id: inputs.projectId,
                };
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                if (inputs.groupId) body.group_id = inputs.groupId;
                if (inputs.assignees) body.assignees = inputs.assignees;
                if (inputs.estimatedHours) body.estimated_hours = inputs.estimatedHours;
                const data = await req('POST', '/tasks', body);
                return { output: { task: data } };
            }
            case 'updateTask': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                if (inputs.percentComplete !== undefined) body.percent_complete = inputs.percentComplete;
                if (inputs.estimatedHours) body.estimated_hours = inputs.estimatedHours;
                const data = await req('PUT', `/tasks/${inputs.taskId}`, body);
                return { output: { task: data } };
            }
            case 'deleteTask': {
                await req('DELETE', `/tasks/${inputs.taskId}`);
                return { output: { success: true, taskId: inputs.taskId } };
            }
            case 'listGroups': {
                const data = await req('GET', `/projects/${inputs.projectId}/groups`);
                return { output: { groups: data } };
            }
            case 'createGroup': {
                const body: any = {
                    name: inputs.name,
                    project_id: inputs.projectId,
                };
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.endDate) body.end_date = inputs.endDate;
                const data = await req('POST', '/groups', body);
                return { output: { group: data } };
            }
            case 'listMilestones': {
                const data = await req('GET', `/projects/${inputs.projectId}/milestones`);
                return { output: { milestones: data } };
            }
            case 'createMilestone': {
                const body: any = {
                    name: inputs.name,
                    project_id: inputs.projectId,
                    date: inputs.date,
                };
                if (inputs.description) body.description = inputs.description;
                const data = await req('POST', '/milestones', body);
                return { output: { milestone: data } };
            }
            case 'listUsers': {
                const data = await req('GET', '/users');
                return { output: { users: data } };
            }
            case 'getUser': {
                const data = await req('GET', `/users/${inputs.userId}`);
                return { output: { user: data } };
            }
            case 'listComments': {
                const data = await req('GET', `/tasks/${inputs.taskId}/comments`);
                return { output: { comments: data } };
            }
            default:
                return { error: `Unknown TeamGantt action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.error?.(`[TeamGantt] Error: ${err.message}`);
        return { error: err.message || 'TeamGantt action failed' };
    }
}
