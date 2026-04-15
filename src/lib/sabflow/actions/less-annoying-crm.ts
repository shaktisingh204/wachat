'use server';

export async function executeLessAnnoyingCRMAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.lessannoyingcrm.com/v1';
    const userCode = inputs.userCode;
    const apiKey = inputs.apiKey;

    const buildUrl = (path: string, params: Record<string, string> = {}) => {
        const url = new URL(`${baseUrl}${path}`);
        url.searchParams.set('UserCode', userCode);
        url.searchParams.set('APIKey', apiKey);
        for (const [k, v] of Object.entries(params)) {
            url.searchParams.set(k, v);
        }
        return url.toString();
    };

    try {
        switch (actionName) {
            case 'createContact': {
                const url = buildUrl('/Contact');
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        FirstName: inputs.firstName,
                        LastName: inputs.lastName,
                        Email: inputs.email ? [{ Text: inputs.email, Type: 'Work' }] : undefined,
                        Phone: inputs.phone ? [{ Text: inputs.phone, Type: 'Work' }] : undefined,
                        CompanyName: inputs.companyName,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to create contact' };
                return { output: data };
            }

            case 'getContact': {
                const url = buildUrl('/Contact', { ContactId: inputs.contactId });
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to get contact' };
                return { output: data };
            }

            case 'updateContact': {
                const url = buildUrl('/Contact');
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ContactId: inputs.contactId,
                        FirstName: inputs.firstName,
                        LastName: inputs.lastName,
                        Email: inputs.email ? [{ Text: inputs.email, Type: 'Work' }] : undefined,
                        Phone: inputs.phone ? [{ Text: inputs.phone, Type: 'Work' }] : undefined,
                        CompanyName: inputs.companyName,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to update contact' };
                return { output: data };
            }

            case 'deleteContact': {
                const url = buildUrl('/Contact', { ContactId: inputs.contactId });
                const res = await fetch(url, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to delete contact' };
                return { output: data };
            }

            case 'listContacts': {
                const params: Record<string, string> = {};
                if (inputs.searchTerm) params.SearchTerm = inputs.searchTerm;
                if (inputs.page) params.Page = String(inputs.page);
                const url = buildUrl('/Contact/List', params);
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to list contacts' };
                return { output: data };
            }

            case 'createLead': {
                const url = buildUrl('/Lead');
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        PipelineId: inputs.pipelineId,
                        StatusId: inputs.statusId,
                        ContactId: inputs.contactId,
                        Description: inputs.description,
                        ClosedOn: inputs.closedOn,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to create lead' };
                return { output: data };
            }

            case 'updateLead': {
                const url = buildUrl('/Lead');
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        LeadId: inputs.leadId,
                        PipelineId: inputs.pipelineId,
                        StatusId: inputs.statusId,
                        Description: inputs.description,
                        ClosedOn: inputs.closedOn,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to update lead' };
                return { output: data };
            }

            case 'getLeadsPipeline': {
                const url = buildUrl('/Pipeline', { PipelineId: inputs.pipelineId });
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to get leads pipeline' };
                return { output: data };
            }

            case 'getLeadReport': {
                const params: Record<string, string> = {};
                if (inputs.pipelineId) params.PipelineId = inputs.pipelineId;
                if (inputs.userId) params.UserId = inputs.userId;
                const url = buildUrl('/Report/Leads', params);
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to get lead report' };
                return { output: data };
            }

            case 'createNote': {
                const url = buildUrl('/Note');
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ContactId: inputs.contactId,
                        Note: inputs.note,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to create note' };
                return { output: data };
            }

            case 'getNote': {
                const url = buildUrl('/Note', { NoteId: inputs.noteId });
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to get note' };
                return { output: data };
            }

            case 'createTask': {
                const url = buildUrl('/Task');
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        DueDate: inputs.dueDate,
                        DueTime: inputs.dueTime,
                        Description: inputs.description,
                        ContactId: inputs.contactId,
                        AssignedTo: inputs.assignedTo,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to create task' };
                return { output: data };
            }

            case 'updateTask': {
                const url = buildUrl('/Task');
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        TaskId: inputs.taskId,
                        DueDate: inputs.dueDate,
                        DueTime: inputs.dueTime,
                        Description: inputs.description,
                        IsCompleted: inputs.isCompleted,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to update task' };
                return { output: data };
            }

            case 'deleteTask': {
                const url = buildUrl('/Task', { TaskId: inputs.taskId });
                const res = await fetch(url, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to delete task' };
                return { output: data };
            }

            case 'getCalendar': {
                const params: Record<string, string> = {};
                if (inputs.startDate) params.StartDate = inputs.startDate;
                if (inputs.endDate) params.EndDate = inputs.endDate;
                if (inputs.userId) params.UserId = inputs.userId;
                const url = buildUrl('/Event/List', params);
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok) return { error: data.Error || 'Failed to get calendar' };
                return { output: data };
            }

            default:
                return { error: `Unknown Less Annoying CRM action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Less Annoying CRM action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred' };
    }
}
