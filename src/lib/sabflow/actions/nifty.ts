'use server';

export async function executeNiftyAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://openapi.niftypm.com/api/v1.0';

        const headers: Record<string, string> = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[Nifty] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Nifty API error ${res.status}: ${text}`);
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
                if (inputs.description) body.description = inputs.description;
                if (inputs.color) body.color = inputs.color;
                if (inputs.teamId) body.team_id = inputs.teamId;
                const data = await req('POST', '/projects', body);
                return { output: { project: data } };
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', inputs.projectId);
                if (inputs.milestoneId) params.set('milestone_id', inputs.milestoneId);
                const data = await req('GET', `/tasks?${params.toString()}`);
                return { output: { tasks: data } };
            }
            case 'getTask': {
                const data = await req('GET', `/tasks/${inputs.taskId}`);
                return { output: { task: data } };
            }
            case 'createTask': {
                const body: any = {
                    title: inputs.title,
                    project_id: inputs.projectId,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.milestoneId) body.milestone_id = inputs.milestoneId;
                if (inputs.assignees) body.assignees = inputs.assignees;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.priority) body.priority = inputs.priority;
                const data = await req('POST', '/tasks', body);
                return { output: { task: data } };
            }
            case 'updateTask': {
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.status) body.status = inputs.status;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.priority) body.priority = inputs.priority;
                const data = await req('PUT', `/tasks/${inputs.taskId}`, body);
                return { output: { task: data } };
            }
            case 'deleteTask': {
                await req('DELETE', `/tasks/${inputs.taskId}`);
                return { output: { success: true, taskId: inputs.taskId } };
            }
            case 'listMilestones': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', inputs.projectId);
                const data = await req('GET', `/milestones?${params.toString()}`);
                return { output: { milestones: data } };
            }
            case 'getMilestone': {
                const data = await req('GET', `/milestones/${inputs.milestoneId}`);
                return { output: { milestone: data } };
            }
            case 'createMilestone': {
                const body: any = {
                    title: inputs.title,
                    project_id: inputs.projectId,
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.startDate) body.start_date = inputs.startDate;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.color) body.color = inputs.color;
                const data = await req('POST', '/milestones', body);
                return { output: { milestone: data } };
            }
            case 'listMembers': {
                const data = await req('GET', `/projects/${inputs.projectId}/members`);
                return { output: { members: data } };
            }
            case 'getMember': {
                const data = await req('GET', `/members/${inputs.memberId}`);
                return { output: { member: data } };
            }
            case 'listDiscussions': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', inputs.projectId);
                const data = await req('GET', `/discussions?${params.toString()}`);
                return { output: { discussions: data } };
            }
            case 'createDiscussion': {
                const body: any = {
                    title: inputs.title,
                    project_id: inputs.projectId,
                };
                if (inputs.body) body.body = inputs.body;
                if (inputs.subscribers) body.subscribers = inputs.subscribers;
                const data = await req('POST', '/discussions', body);
                return { output: { discussion: data } };
            }
            default:
                return { error: `Unknown Nifty action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.error?.(`[Nifty] Error: ${err.message}`);
        return { error: err.message || 'Nifty action failed' };
    }
}
