'use server';

export async function executeShortcutAction(actionName: string, inputs: any, user: any, logger: any) {
    const base = 'https://api.app.shortcut.com/api/v3';
    const headers = {
        'Content-Type': 'application/json',
        'Shortcut-Token': inputs.apiToken,
    };

    try {
        switch (actionName) {
            case 'listStories': {
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', String(inputs.projectId));
                if (inputs.epicId) params.set('epic_id', String(inputs.epicId));
                const res = await fetch(`${base}/stories?${params}`, { headers });
                const data = await res.json();
                return { output: { stories: Array.isArray(data) ? data : [] } };
            }
            case 'getStory': {
                const res = await fetch(`${base}/stories/${inputs.storyPublicId}`, { headers });
                const data = await res.json();
                return { output: { story: data } };
            }
            case 'createStory': {
                const body: any = { name: inputs.name, project_id: inputs.projectId };
                if (inputs.description) body.description = inputs.description;
                if (inputs.story_type) body.story_type = inputs.story_type;
                if (inputs.owner_ids) body.owner_ids = inputs.owner_ids;
                if (inputs.epic_id) body.epic_id = inputs.epic_id;
                if (inputs.workflow_state_id) body.workflow_state_id = inputs.workflow_state_id;
                const res = await fetch(`${base}/stories`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { story: data } };
            }
            case 'updateStory': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.workflow_state_id) body.workflow_state_id = inputs.workflow_state_id;
                if (inputs.owner_ids) body.owner_ids = inputs.owner_ids;
                if (inputs.epic_id !== undefined) body.epic_id = inputs.epic_id;
                const res = await fetch(`${base}/stories/${inputs.storyPublicId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { story: data } };
            }
            case 'deleteStory': {
                const res = await fetch(`${base}/stories/${inputs.storyPublicId}`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'listEpics': {
                const res = await fetch(`${base}/epics`, { headers });
                const data = await res.json();
                return { output: { epics: Array.isArray(data) ? data : [] } };
            }
            case 'getEpic': {
                const res = await fetch(`${base}/epics/${inputs.epicPublicId}`, { headers });
                const data = await res.json();
                return { output: { epic: data } };
            }
            case 'createEpic': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.milestone_id) body.milestone_id = inputs.milestone_id;
                if (inputs.owner_ids) body.owner_ids = inputs.owner_ids;
                if (inputs.state) body.state = inputs.state;
                const res = await fetch(`${base}/epics`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { epic: data } };
            }
            case 'updateEpic': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.state) body.state = inputs.state;
                if (inputs.milestone_id !== undefined) body.milestone_id = inputs.milestone_id;
                const res = await fetch(`${base}/epics/${inputs.epicPublicId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { epic: data } };
            }
            case 'listMilestones': {
                const res = await fetch(`${base}/milestones`, { headers });
                const data = await res.json();
                return { output: { milestones: Array.isArray(data) ? data : [] } };
            }
            case 'createMilestone': {
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.state) body.state = inputs.state;
                const res = await fetch(`${base}/milestones`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { milestone: data } };
            }
            case 'listProjects': {
                const res = await fetch(`${base}/projects`, { headers });
                const data = await res.json();
                return { output: { projects: Array.isArray(data) ? data : [] } };
            }
            case 'getProject': {
                const res = await fetch(`${base}/projects/${inputs.projectId}`, { headers });
                const data = await res.json();
                return { output: { project: data } };
            }
            case 'searchStories': {
                const body: any = { query: inputs.query };
                if (inputs.page_size) body.page_size = inputs.page_size;
                const res = await fetch(`${base}/search/stories`, { method: 'GET', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: { stories: data.data ?? [], total: data.total } };
            }
            case 'listMembers': {
                const res = await fetch(`${base}/members`, { headers });
                const data = await res.json();
                return { output: { members: Array.isArray(data) ? data : [] } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Shortcut action error: ${err.message}`);
        return { error: err.message };
    }
}
