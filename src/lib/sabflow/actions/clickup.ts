
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

async function clickupRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    token: string,
    body?: any
) {
    const res = await axios({
        method,
        url: `${CLICKUP_BASE}${path}`,
        data: body,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    return res.data;
}

function parseCommaSeparatedIds(value: any): number[] {
    return String(value ?? '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .map(Number)
        .filter((n: number) => !isNaN(n));
}

export async function executeClickUpAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');

        switch (actionName) {
            case 'createTask': {
                const listId = String(inputs.listId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.priority) body.priority = Number(inputs.priority);
                if (inputs.assignees) body.assignees = parseCommaSeparatedIds(inputs.assignees);
                if (inputs.dueDate) body.due_date = new Date(String(inputs.dueDate)).getTime();
                if (inputs.tags) body.tags = String(inputs.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
                if (inputs.status) body.status = String(inputs.status);
                const data = await clickupRequest('POST', `/list/${listId}/task`, token, body);
                logger.log(`[ClickUp] Created task ${data.id}`);
                return { output: { id: data.id, name: data.name, url: data.url } };
            }

            case 'getTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const data = await clickupRequest('GET', `/task/${taskId}`, token);
                return {
                    output: {
                        id: data.id,
                        name: data.name,
                        description: data.description,
                        status: data.status?.status,
                        priority: data.priority?.priority,
                        assignees: data.assignees,
                        dueDate: data.due_date,
                        url: data.url,
                    },
                };
            }

            case 'updateTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                const body: Record<string, any> = {};
                if (inputs.name !== undefined && inputs.name !== '') body.name = String(inputs.name);
                if (inputs.description !== undefined && inputs.description !== '') body.description = String(inputs.description);
                if (inputs.status !== undefined && inputs.status !== '') body.status = String(inputs.status);
                if (inputs.priority !== undefined && inputs.priority !== '') body.priority = Number(inputs.priority);
                if (inputs.dueDate !== undefined && inputs.dueDate !== '') body.due_date = new Date(String(inputs.dueDate)).getTime();
                if (Object.keys(body).length === 0) throw new Error('At least one field to update is required.');
                await clickupRequest('PUT', `/task/${taskId}`, token, body);
                return { output: { success: 'true' } };
            }

            case 'deleteTask': {
                const taskId = String(inputs.taskId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                await clickupRequest('DELETE', `/task/${taskId}`, token);
                logger.log(`[ClickUp] Deleted task ${taskId}`);
                return { output: { success: 'true' } };
            }

            case 'addTaskComment': {
                const taskId = String(inputs.taskId ?? '').trim();
                const commentText = String(inputs.commentText ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                if (!commentText) throw new Error('commentText is required.');
                const body: Record<string, any> = { comment_text: commentText };
                if (inputs.notifyAll !== undefined && inputs.notifyAll !== '')
                    body.notify_all = String(inputs.notifyAll).toLowerCase() === 'true';
                const data = await clickupRequest('POST', `/task/${taskId}/comment`, token, body);
                logger.log(`[ClickUp] Added comment to task ${taskId}`);
                return { output: { id: data.id } };
            }

            case 'createList': {
                const folderId = String(inputs.folderId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!folderId) throw new Error('folderId is required.');
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name };
                if (inputs.content) body.content = String(inputs.content);
                const data = await clickupRequest('POST', `/folder/${folderId}/list`, token, body);
                logger.log(`[ClickUp] Created list ${data.id}`);
                return { output: { id: data.id, name: data.name } };
            }

            case 'getListTasks': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                let path = `/list/${listId}/task`;
                const queryParams: string[] = [];
                if (inputs.statuses) {
                    const statuses = String(inputs.statuses).split(',').map((s: string) => s.trim()).filter(Boolean);
                    statuses.forEach((s: string) => queryParams.push(`statuses[]=${encodeURIComponent(s)}`));
                }
                if (inputs.includeSubtasks !== undefined && inputs.includeSubtasks !== '')
                    queryParams.push(`subtasks=${String(inputs.includeSubtasks).toLowerCase() === 'true'}`);
                if (queryParams.length) path += `?${queryParams.join('&')}`;
                const data = await clickupRequest('GET', path, token);
                return { output: { tasks: data.tasks || [] } };
            }

            case 'createSubtask': {
                const parentTaskId = String(inputs.parentTaskId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!parentTaskId) throw new Error('parentTaskId is required.');
                if (!name) throw new Error('name is required.');
                const body: Record<string, any> = { name, parent: parentTaskId };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.assignees) body.assignees = parseCommaSeparatedIds(inputs.assignees);
                // Subtasks are created via the task's list endpoint — ClickUp requires knowing the list.
                // Use the parent task's list by fetching it first.
                const parent = await clickupRequest('GET', `/task/${parentTaskId}`, token);
                const listId = parent.list?.id;
                if (!listId) throw new Error('Could not determine list for parent task.');
                const data = await clickupRequest('POST', `/list/${listId}/task`, token, body);
                logger.log(`[ClickUp] Created subtask ${data.id} under ${parentTaskId}`);
                return { output: { id: data.id, name: data.name } };
            }

            case 'setTaskCustomField': {
                const taskId = String(inputs.taskId ?? '').trim();
                const fieldId = String(inputs.fieldId ?? '').trim();
                if (!taskId) throw new Error('taskId is required.');
                if (!fieldId) throw new Error('fieldId is required.');
                let value = inputs.value;
                try { value = JSON.parse(String(value)); } catch { value = String(value ?? ''); }
                await clickupRequest('POST', `/task/${taskId}/field/${fieldId}`, token, { value });
                return { output: { success: 'true' } };
            }

            case 'getSpaceMembers': {
                const spaceId = String(inputs.spaceId ?? '').trim();
                if (!spaceId) throw new Error('spaceId is required.');
                const data = await clickupRequest('GET', `/space/${spaceId}/member`, token);
                return { output: { members: data.members || [] } };
            }

            default:
                return { error: `ClickUp action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.err || e?.response?.data?.error || e.message || 'ClickUp action failed.';
        return { error: String(msg) };
    }
}
