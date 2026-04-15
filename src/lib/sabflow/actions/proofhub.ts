'use server';

export async function executeProofHubAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = inputs.apiKey;
        const baseUrl = 'https://yourcompany.proofhub.com/api/v3';

        const headers: Record<string, string> = {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[ProofHub] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`ProofHub API error ${res.status}: ${text}`);
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
                if (inputs.category) body.category = inputs.category;
                const data = await req('POST', '/projects', body);
                return { output: { project: data } };
            }
            case 'listTasks': {
                const data = await req('GET', `/projects/${inputs.projectId}/todolists/${inputs.todolistId}/todos`);
                return { output: { tasks: data } };
            }
            case 'getTask': {
                const data = await req('GET', `/projects/${inputs.projectId}/todolists/${inputs.todolistId}/todos/${inputs.taskId}`);
                return { output: { task: data } };
            }
            case 'createTask': {
                const body: any = { title: inputs.title };
                if (inputs.description) body.description = inputs.description;
                if (inputs.assignees) body.assignees = inputs.assignees;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.estimatedHours) body.estimated_hours = inputs.estimatedHours;
                const data = await req('POST', `/projects/${inputs.projectId}/todolists/${inputs.todolistId}/todos`, body);
                return { output: { task: data } };
            }
            case 'updateTask': {
                const body: any = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.status) body.status = inputs.status;
                const data = await req('PUT', `/projects/${inputs.projectId}/todolists/${inputs.todolistId}/todos/${inputs.taskId}`, body);
                return { output: { task: data } };
            }
            case 'deleteTask': {
                await req('DELETE', `/projects/${inputs.projectId}/todolists/${inputs.todolistId}/todos/${inputs.taskId}`);
                return { output: { success: true, taskId: inputs.taskId } };
            }
            case 'listTimelogs': {
                const data = await req('GET', `/projects/${inputs.projectId}/timelogs`);
                return { output: { timelogs: data } };
            }
            case 'createTimelog': {
                const body: any = {
                    date: inputs.date,
                    hours: inputs.hours,
                    minutes: inputs.minutes,
                    description: inputs.description,
                };
                if (inputs.billable !== undefined) body.billable = inputs.billable;
                const data = await req('POST', `/projects/${inputs.projectId}/timelogs`, body);
                return { output: { timelog: data } };
            }
            case 'listNotes': {
                const data = await req('GET', `/projects/${inputs.projectId}/notebooks`);
                return { output: { notes: data } };
            }
            case 'createNote': {
                const body: any = {
                    title: inputs.title,
                    content: inputs.content,
                };
                if (inputs.folderId) body.folder_id = inputs.folderId;
                const data = await req('POST', `/projects/${inputs.projectId}/notebooks`, body);
                return { output: { note: data } };
            }
            case 'listMessages': {
                const data = await req('GET', `/projects/${inputs.projectId}/topics`);
                return { output: { messages: data } };
            }
            case 'createMessage': {
                const body: any = {
                    title: inputs.title,
                    description: inputs.description,
                };
                if (inputs.private !== undefined) body.private = inputs.private;
                const data = await req('POST', `/projects/${inputs.projectId}/topics`, body);
                return { output: { message: data } };
            }
            case 'listFiles': {
                const data = await req('GET', `/projects/${inputs.projectId}/files`);
                return { output: { files: data } };
            }
            default:
                return { error: `Unknown ProofHub action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.error?.(`[ProofHub] Error: ${err.message}`);
        return { error: err.message || 'ProofHub action failed' };
    }
}
