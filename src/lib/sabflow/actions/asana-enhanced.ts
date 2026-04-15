'use server';

export async function executeAsanaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://app.asana.com/api/1.0';

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listWorkspaces': {
                url = `${BASE}/workspaces`;
                break;
            }
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.workspace) params.set('workspace', inputs.workspace);
                if (inputs.team) params.set('team', inputs.team);
                if (inputs.archived !== undefined) params.set('archived', String(inputs.archived));
                url = `${BASE}/projects?${params.toString()}`;
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
                    data: {
                        name: inputs.name,
                        workspace: inputs.workspace,
                        team: inputs.team,
                        notes: inputs.notes,
                        color: inputs.color,
                        is_template: inputs.isTemplate,
                        public: inputs.public,
                        default_view: inputs.defaultView,
                        due_date: inputs.dueDate,
                        start_on: inputs.startOn,
                    },
                });
                break;
            }
            case 'updateProject': {
                url = `${BASE}/projects/${inputs.projectId}`;
                method = 'PUT';
                body = JSON.stringify({
                    data: {
                        name: inputs.name,
                        notes: inputs.notes,
                        color: inputs.color,
                        archived: inputs.archived,
                        due_date: inputs.dueDate,
                        start_on: inputs.startOn,
                    },
                });
                break;
            }
            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.project) params.set('project', inputs.project);
                if (inputs.assignee) params.set('assignee', inputs.assignee);
                if (inputs.workspace) params.set('workspace', inputs.workspace);
                if (inputs.section) params.set('section', inputs.section);
                if (inputs.completed) params.set('completed_since', inputs.completed);
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
                    data: {
                        name: inputs.name,
                        notes: inputs.notes,
                        assignee: inputs.assignee,
                        projects: inputs.projects,
                        workspace: inputs.workspace,
                        due_on: inputs.dueOn,
                        due_at: inputs.dueAt,
                        start_on: inputs.startOn,
                        completed: inputs.completed,
                        followers: inputs.followers,
                        tags: inputs.tags,
                        parent: inputs.parent,
                    },
                });
                break;
            }
            case 'updateTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'PUT';
                body = JSON.stringify({
                    data: {
                        name: inputs.name,
                        notes: inputs.notes,
                        assignee: inputs.assignee,
                        due_on: inputs.dueOn,
                        due_at: inputs.dueAt,
                        completed: inputs.completed,
                    },
                });
                break;
            }
            case 'deleteTask': {
                url = `${BASE}/tasks/${inputs.taskId}`;
                method = 'DELETE';
                break;
            }
            case 'addComment': {
                url = `${BASE}/tasks/${inputs.taskId}/stories`;
                method = 'POST';
                body = JSON.stringify({
                    data: {
                        text: inputs.text,
                        is_pinned: inputs.isPinned ?? false,
                    },
                });
                break;
            }
            case 'listComments': {
                url = `${BASE}/tasks/${inputs.taskId}/stories`;
                break;
            }
            case 'listSections': {
                url = `${BASE}/projects/${inputs.projectId}/sections`;
                break;
            }
            case 'createSection': {
                url = `${BASE}/projects/${inputs.projectId}/sections`;
                method = 'POST';
                body = JSON.stringify({
                    data: {
                        name: inputs.name,
                        insert_before: inputs.insertBefore,
                        insert_after: inputs.insertAfter,
                    },
                });
                break;
            }
            case 'addTaskToSection': {
                url = `${BASE}/sections/${inputs.sectionId}/addTask`;
                method = 'POST';
                body = JSON.stringify({
                    data: {
                        task: inputs.taskId,
                        insert_before: inputs.insertBefore,
                        insert_after: inputs.insertAfter,
                    },
                });
                break;
            }
            default:
                return { error: `Unknown Asana Enhanced action: ${actionName}` };
        }

        const res = await fetch(url, {
            method,
            headers,
            body,
        });

        const data = await res.json();

        if (!res.ok) {
            const errMsg = data.errors?.[0]?.message || data.message || `Asana API error: ${res.status}`;
            return { error: errMsg };
        }

        return { output: data.data ?? data };
    } catch (err: any) {
        logger.log(`Asana Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
