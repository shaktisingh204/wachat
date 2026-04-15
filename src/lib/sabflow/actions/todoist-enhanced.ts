'use server';

export async function executeTodoistEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.todoist.com/rest/v2';

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.apiToken}`,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listProjects': {
                url = `${BASE}/projects`;
                break;
            }
            case 'getProject': {
                url = `${BASE}/projects/${inputs.projectId}`;
                break;
            }
            case 'createProject': {
                url = `${BASE}/projects`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    parent_id: inputs.parentId,
                    color: inputs.color,
                    is_favorite: inputs.isFavorite,
                    view_style: inputs.viewStyle,
                });
                break;
            }
            case 'updateProject': {
                url = `${BASE}/projects/${inputs.projectId}`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    color: inputs.color,
                    is_favorite: inputs.isFavorite,
                    view_style: inputs.viewStyle,
                });
                break;
            }
            case 'deleteProject': {
                url = `${BASE}/projects/${inputs.projectId}`;
                method = 'DELETE';
                break;
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', inputs.projectId);
                if (inputs.sectionId) params.set('section_id', inputs.sectionId);
                if (inputs.label) params.set('label', inputs.label);
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.lang) params.set('lang', inputs.lang);
                if (inputs.ids) params.set('ids', inputs.ids);
                url = `${BASE}/tasks?${params.toString()}`;
                break;
            }
            case 'getTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                break;
            }
            case 'createTask': {
                url = `${BASE}/tasks`;
                method = 'POST';
                body = JSON.stringify({
                    content: inputs.content,
                    description: inputs.description,
                    project_id: inputs.projectId,
                    section_id: inputs.sectionId,
                    parent_id: inputs.parentId,
                    order: inputs.order,
                    labels: inputs.labels,
                    priority: inputs.priority,
                    due_string: inputs.dueString,
                    due_date: inputs.dueDate,
                    due_datetime: inputs.dueDatetime,
                    due_lang: inputs.dueLang,
                    assignee_id: inputs.assigneeId,
                    duration: inputs.duration,
                    duration_unit: inputs.durationUnit,
                });
                break;
            }
            case 'updateTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'POST';
                body = JSON.stringify({
                    content: inputs.content,
                    description: inputs.description,
                    labels: inputs.labels,
                    priority: inputs.priority,
                    due_string: inputs.dueString,
                    due_date: inputs.dueDate,
                    due_datetime: inputs.dueDatetime,
                    due_lang: inputs.dueLang,
                    assignee_id: inputs.assigneeId,
                    duration: inputs.duration,
                    duration_unit: inputs.durationUnit,
                });
                break;
            }
            case 'closeTask': {
                url = `${BASE}/tasks/${inputs.taskId}/close`;
                method = 'POST';
                break;
            }
            case 'reopenTask': {
                url = `${BASE}/tasks/${inputs.taskId}/reopen`;
                method = 'POST';
                break;
            }
            case 'deleteTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'DELETE';
                break;
            }
            case 'listSections': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', inputs.projectId);
                url = `${BASE}/sections?${params.toString()}`;
                break;
            }
            case 'createSection': {
                url = `${BASE}/sections`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    project_id: inputs.projectId,
                    order: inputs.order,
                });
                break;
            }
            case 'addComment': {
                url = `${BASE}/comments`;
                method = 'POST';
                body = JSON.stringify({
                    task_id: inputs.taskId,
                    project_id: inputs.projectId,
                    content: inputs.content,
                    attachment: inputs.attachment,
                });
                break;
            }
            default:
                return { error: `Unknown Todoist Enhanced action: ${actionName}` };
        }

        const res = await fetch(url, {
            method,
            headers,
            body,
        });

        if (res.status === 204) {
            return { output: { success: true } };
        }

        const data = await res.json();

        if (!res.ok) {
            return { error: data.error || data.message || `Todoist API error: ${res.status}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`Todoist Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
