'use server';

export async function executeZohoProjectsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    const { accessToken, portalId } = inputs;

    if (!accessToken) return { error: 'accessToken is required' };
    if (!portalId) return { error: 'portalId is required' };

    const base = `https://projectsapi.zoho.com/restapi/portal/${portalId}`;
    const headers: Record<string, string> = {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
    };

    async function req(method: string, url: string, body?: any, query?: Record<string, string>) {
        let fullUrl = url;
        if (query) fullUrl += `?${new URLSearchParams(query).toString()}`;
        const res = await fetch(fullUrl, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`ZohoProjects ${method} ${url} failed (${res.status}): ${text}`);
        }
        const text = await res.text();
        return text ? JSON.parse(text) : { success: true };
    }

    try {
        switch (actionName) {
            case 'listProjects': {
                const { status, range } = inputs;
                const query: Record<string, string> = {};
                if (status) query.status = status;
                if (range) query.range = String(range);
                const data = await req('GET', `${base}/projects/`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getProject': {
                const { projectId } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const data = await req('GET', `${base}/projects/${projectId}/`);
                return { output: data };
            }

            case 'createProject': {
                const { name, description, startDate, endDate } = inputs;
                if (!name) return { error: 'name is required' };
                const body: any = { name };
                if (description) body.description = description;
                if (startDate) body.start_date = startDate;
                if (endDate) body.end_date = endDate;
                const data = await req('POST', `${base}/projects/`, body);
                return { output: data };
            }

            case 'updateProject': {
                const { projectId, name, description, status } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const body: any = {};
                if (name) body.name = name;
                if (description) body.description = description;
                if (status) body.status = status;
                const data = await req('POST', `${base}/projects/${projectId}/`, body);
                return { output: data };
            }

            case 'deleteProject': {
                const { projectId } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const data = await req('DELETE', `${base}/projects/${projectId}/`);
                return { output: data };
            }

            case 'listTasks': {
                const { projectId, status } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const query: Record<string, string> = {};
                if (status) query.status = status;
                const data = await req('GET', `${base}/projects/${projectId}/tasks/`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getTask': {
                const { projectId, taskId } = inputs;
                if (!projectId || !taskId) return { error: 'projectId and taskId are required' };
                const data = await req('GET', `${base}/projects/${projectId}/tasks/${taskId}/`);
                return { output: data };
            }

            case 'createTask': {
                const { projectId, name, description, assignee, dueDate } = inputs;
                if (!projectId || !name) return { error: 'projectId and name are required' };
                const body: any = { name };
                if (description) body.description = description;
                if (assignee) body.person_responsible = assignee;
                if (dueDate) body.due_date = dueDate;
                const data = await req('POST', `${base}/projects/${projectId}/tasks/`, body);
                return { output: data };
            }

            case 'updateTask': {
                const { projectId, taskId, name, status, description } = inputs;
                if (!projectId || !taskId) return { error: 'projectId and taskId are required' };
                const body: any = {};
                if (name) body.name = name;
                if (status) body.status = status;
                if (description) body.description = description;
                const data = await req('POST', `${base}/projects/${projectId}/tasks/${taskId}/`, body);
                return { output: data };
            }

            case 'deleteTask': {
                const { projectId, taskId } = inputs;
                if (!projectId || !taskId) return { error: 'projectId and taskId are required' };
                const data = await req('DELETE', `${base}/projects/${projectId}/tasks/${taskId}/`);
                return { output: data };
            }

            case 'listMilestones': {
                const { projectId, flag } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const query: Record<string, string> = {};
                if (flag) query.flag = flag;
                const data = await req('GET', `${base}/projects/${projectId}/milestones/`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'createMilestone': {
                const { projectId, name, endDate, flag } = inputs;
                if (!projectId || !name || !endDate) return { error: 'projectId, name, and endDate are required' };
                const body: any = { name, end_date: endDate };
                if (flag) body.flag = flag;
                const data = await req('POST', `${base}/projects/${projectId}/milestones/`, body);
                return { output: data };
            }

            case 'listIssues': {
                const { projectId, status } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const query: Record<string, string> = {};
                if (status) query.status = status;
                const data = await req('GET', `${base}/projects/${projectId}/bugs/`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'getIssue': {
                const { projectId, issueId } = inputs;
                if (!projectId || !issueId) return { error: 'projectId and issueId are required' };
                const data = await req('GET', `${base}/projects/${projectId}/bugs/${issueId}/`);
                return { output: data };
            }

            case 'createIssue': {
                const { projectId, title, description, severity, assignee } = inputs;
                if (!projectId || !title) return { error: 'projectId and title are required' };
                const body: any = { title };
                if (description) body.description = description;
                if (severity) body.severity = severity;
                if (assignee) body.assignee = assignee;
                const data = await req('POST', `${base}/projects/${projectId}/bugs/`, body);
                return { output: data };
            }

            case 'updateIssue': {
                const { projectId, issueId, title, status, severity } = inputs;
                if (!projectId || !issueId) return { error: 'projectId and issueId are required' };
                const body: any = {};
                if (title) body.title = title;
                if (status) body.status = status;
                if (severity) body.severity = severity;
                const data = await req('POST', `${base}/projects/${projectId}/bugs/${issueId}/`, body);
                return { output: data };
            }

            case 'listTimelogs': {
                const { projectId, billStatus } = inputs;
                if (!projectId) return { error: 'projectId is required' };
                const query: Record<string, string> = {};
                if (billStatus) query.bill_status = billStatus;
                const data = await req('GET', `${base}/projects/${projectId}/logs/`, undefined, Object.keys(query).length ? query : undefined);
                return { output: data };
            }

            case 'addTimelog': {
                const { projectId, taskId, date, hours, minutes, notes, billable } = inputs;
                if (!projectId || !taskId || !date || hours === undefined) {
                    return { error: 'projectId, taskId, date, and hours are required' };
                }
                const body: any = { date, hours: String(hours) };
                if (minutes) body.minutes = String(minutes);
                if (notes) body.notes = notes;
                if (billable !== undefined) body.bill_status = billable ? 'Billable' : 'Non Billable';
                const data = await req('POST', `${base}/projects/${projectId}/tasks/${taskId}/logs/`, body);
                return { output: data };
            }

            case 'listUsers': {
                const data = await req('GET', `${base}/users/`);
                return { output: data };
            }

            case 'getUser': {
                const { userId } = inputs;
                if (!userId) return { error: 'userId is required' };
                const data = await req('GET', `${base}/users/${userId}/`);
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
