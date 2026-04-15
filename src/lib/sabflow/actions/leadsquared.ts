
'use server';

const LEADSQUARED_BASE = 'https://api.leadsquared.com/v2';

async function lsFetch(
    accessKey: string,
    secretKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[LeadSquared] ${method} ${path}`);
    const url = new URL(`${LEADSQUARED_BASE}${path}`);
    url.searchParams.set('accessKey', accessKey);
    url.searchParams.set('secretKey', secretKey);
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url.toString(), options);
    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { Message: text };
    }
    if (!res.ok) {
        throw new Error(data?.Message || data?.ExceptionMessage || `LeadSquared API error: ${res.status}`);
    }
    return data;
}

export async function executeLeadSquaredAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessKey = String(inputs.accessKey ?? '').trim();
        const secretKey = String(inputs.secretKey ?? '').trim();
        if (!accessKey || !secretKey) throw new Error('accessKey and secretKey are required.');

        const ls = (method: string, path: string, body?: any) =>
            lsFetch(accessKey, secretKey, method, path, body, logger);

        switch (actionName) {
            // Leads
            case 'createLead': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const attributes: any[] = [{ Attribute: 'EmailAddress', Value: email }];
                if (inputs.firstName) attributes.push({ Attribute: 'FirstName', Value: String(inputs.firstName) });
                if (inputs.lastName) attributes.push({ Attribute: 'LastName', Value: String(inputs.lastName) });
                if (inputs.phone) attributes.push({ Attribute: 'Phone', Value: String(inputs.phone) });
                if (inputs.company) attributes.push({ Attribute: 'Company', Value: String(inputs.company) });
                if (inputs.source) attributes.push({ Attribute: 'Source', Value: String(inputs.source) });
                if (inputs.extraAttributes && Array.isArray(inputs.extraAttributes)) {
                    attributes.push(...inputs.extraAttributes);
                }
                const data = await ls('POST', '/LeadManagement.svc/Lead.Create', attributes);
                logger.log(`[LeadSquared] Created lead ${data.Message?.Id}`);
                return { output: { leadId: data.Message?.Id, status: data.Status } };
            }

            case 'updateLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const attributes: any[] = [{ Attribute: 'ProspectID', Value: leadId }];
                if (inputs.firstName) attributes.push({ Attribute: 'FirstName', Value: String(inputs.firstName) });
                if (inputs.lastName) attributes.push({ Attribute: 'LastName', Value: String(inputs.lastName) });
                if (inputs.phone) attributes.push({ Attribute: 'Phone', Value: String(inputs.phone) });
                if (inputs.company) attributes.push({ Attribute: 'Company', Value: String(inputs.company) });
                if (inputs.extraAttributes && Array.isArray(inputs.extraAttributes)) {
                    attributes.push(...inputs.extraAttributes);
                }
                const data = await ls('POST', '/LeadManagement.svc/Lead.Update', attributes);
                return { output: { updated: true, leadId, status: data.Status } };
            }

            case 'getLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const data = await ls('GET', `/LeadManagement.svc/Lead.GetById?id=${leadId}`);
                return { output: { lead: data.Lead ?? data } };
            }

            case 'searchLeads': {
                const body: any = {
                    Columns: { Include_CSV: inputs.columns ?? 'ProspectID,FirstName,LastName,EmailAddress,Phone' },
                    Sorting: { ColumnName: inputs.sortBy ?? 'CreatedOn', Direction: inputs.sortDir ?? 'DESC' },
                    Paging: { PageIndex: Number(inputs.page ?? 1), PageSize: Math.min(200, Number(inputs.pageSize ?? 25)) },
                };
                if (inputs.searchParameters) {
                    body.Parameter = { LookupName: inputs.searchField ?? 'EmailAddress', LookupValue: String(inputs.searchValue ?? '') };
                }
                const data = await ls('POST', '/LeadManagement.svc/Leads.GetByFilter', body);
                return { output: { leads: data.Leads ?? data.List ?? [], count: data.RecordCount } };
            }

            case 'getLeadActivities': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const data = await ls('GET', `/ProspectActivity.svc/Leadactivities.Get?id=${leadId}&pageIndex=${inputs.page ?? 1}&pageSize=${inputs.pageSize ?? 25}`);
                return { output: { activities: data.ProspectActivities ?? [] } };
            }

            case 'captureActivity': {
                const leadId = String(inputs.leadId ?? '').trim();
                const activityEvent = String(inputs.activityEvent ?? '').trim();
                if (!leadId || !activityEvent) throw new Error('leadId and activityEvent are required.');
                const body: any = {
                    LeadId: leadId,
                    Activity: {
                        ActivityEvent: Number(activityEvent) || activityEvent,
                        ActivityNote: inputs.note ? String(inputs.note) : undefined,
                        ActivityDateTime: inputs.activityDateTime ?? new Date().toISOString().replace('T', ' ').substring(0, 19),
                    },
                };
                if (inputs.fields && typeof inputs.fields === 'object') {
                    body.Activity.Fields = Object.entries(inputs.fields).map(([k, v]) => ({ SchemaName: k, Value: v }));
                }
                const data = await ls('POST', '/ProspectActivity.svc/CaptureActivity', body);
                return { output: { activityId: data.Message?.Id, status: data.Status } };
            }

            // Lead Lists
            case 'getLeadList': {
                const listId = inputs.listId ? `?listId=${inputs.listId}` : '';
                const data = await ls('GET', `/LeadManagement.svc/List.GetAll${listId}`);
                return { output: { lists: Array.isArray(data) ? data : [data] } };
            }

            case 'addLeadToList': {
                const leadId = String(inputs.leadId ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!leadId || !listId) throw new Error('leadId and listId are required.');
                const data = await ls('POST', '/LeadManagement.svc/List.AddMembers', { Id: listId, Leads: [{ LeadId: leadId }] });
                return { output: { added: true, leadId, listId, status: data.Status } };
            }

            case 'removeLeadFromList': {
                const leadId = String(inputs.leadId ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!leadId || !listId) throw new Error('leadId and listId are required.');
                const data = await ls('POST', '/LeadManagement.svc/List.RemoveMembers', { Id: listId, Leads: [{ LeadId: leadId }] });
                return { output: { removed: true, leadId, listId, status: data.Status } };
            }

            // Email
            case 'sendEmail': {
                const leadId = String(inputs.leadId ?? '').trim();
                const templateId = String(inputs.templateId ?? '').trim();
                if (!leadId || !templateId) throw new Error('leadId and templateId are required.');
                const body: any = { LeadId: leadId, TemplateId: templateId };
                if (inputs.senderEmail) body.FromEmailAddress = String(inputs.senderEmail);
                if (inputs.senderName) body.FromName = String(inputs.senderName);
                const data = await ls('POST', '/Messaging.svc/Email.Send', body);
                return { output: { sent: true, status: data.Status } };
            }

            case 'getEmailStats': {
                const templateId = inputs.templateId ? `?templateId=${inputs.templateId}` : '';
                const data = await ls('GET', `/Reporting.svc/EmailStats.Get${templateId}`);
                return { output: { stats: data } };
            }

            // Tasks
            case 'createTask': {
                const leadId = String(inputs.leadId ?? '').trim();
                const taskName = String(inputs.taskName ?? '').trim();
                if (!leadId || !taskName) throw new Error('leadId and taskName are required.');
                const body: any = {
                    LeadId: leadId,
                    TaskName: taskName,
                    DueDate: inputs.dueDate ?? new Date(Date.now() + 86400000).toISOString().substring(0, 10),
                };
                if (inputs.description) body.Description = String(inputs.description);
                if (inputs.ownerId) body.OwnerId = String(inputs.ownerId);
                const data = await ls('POST', '/TaskManagement.svc/Task.Create', body);
                logger.log(`[LeadSquared] Created task ${data.Message?.Id}`);
                return { output: { taskId: data.Message?.Id, status: data.Status } };
            }

            case 'getTasks': {
                const leadId = String(inputs.leadId ?? '').trim();
                const query = leadId ? `?leadId=${leadId}` : '';
                const data = await ls('GET', `/TaskManagement.svc/Task.GetByFilter${query}`);
                return { output: { tasks: data.Tasks ?? data ?? [] } };
            }

            // Opportunities
            case 'getOpportunity': {
                const opportunityId = String(inputs.opportunityId ?? '').trim();
                if (!opportunityId) throw new Error('opportunityId is required.');
                const data = await ls('GET', `/Opportunity.svc/Opportunities.GetById?id=${opportunityId}`);
                return { output: { opportunity: data.Opportunity ?? data } };
            }

            case 'createOpportunity': {
                const leadId = String(inputs.leadId ?? '').trim();
                const opportunityValue = Number(inputs.opportunityValue ?? 0);
                if (!leadId) throw new Error('leadId is required.');
                const body: any = {
                    LeadId: leadId,
                    OpportunityValue: opportunityValue,
                    OpportunityName: inputs.opportunityName ? String(inputs.opportunityName) : `Opportunity for ${leadId}`,
                };
                if (inputs.stage) body.Stage = String(inputs.stage);
                if (inputs.closeDate) body.CloseDate = String(inputs.closeDate);
                if (inputs.ownerId) body.OwnerId = String(inputs.ownerId);
                const data = await ls('POST', '/Opportunity.svc/Opportunities.Create', body);
                logger.log(`[LeadSquared] Created opportunity ${data.Message?.Id}`);
                return { output: { opportunityId: data.Message?.Id, status: data.Status } };
            }

            // Users
            case 'getUsers': {
                const data = await ls('GET', '/Configuration.svc/Users.Get');
                return { output: { users: data.Users ?? data ?? [] } };
            }

            // Sales Activities
            case 'getSalesActivities': {
                const data = await ls('GET', '/Configuration.svc/SalesActivities.Get');
                return { output: { salesActivities: data.SalesActivities ?? data ?? [] } };
            }

            default:
                return { error: `LeadSquared action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'LeadSquared action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}
