
'use server';

const INSIGHTLY_BASE = 'https://api.insightly.com/v3.1';

async function insightlyFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Insightly] ${method} ${path}`);
    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
    const url = `${INSIGHTLY_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.Message || data?.error?.message || `Insightly API error: ${res.status}`);
    }
    return data;
}

export async function executeInsightlyAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const ins = (method: string, path: string, body?: any) =>
            insightlyFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            // Contacts
            case 'listContacts': {
                const top = Math.max(1, Math.min(500, Number(inputs.top) || 50));
                const skip = Math.max(0, Number(inputs.skip) || 0);
                const data = await ins('GET', `/Contacts?top=${top}&skip=${skip}`);
                return { output: { contacts: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await ins('GET', `/Contacts/${contactId}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                if (!lastName) throw new Error('lastName is required.');
                const body: any = { LAST_NAME: lastName };
                if (firstName) body.FIRST_NAME = firstName;
                if (inputs.email) {
                    body.LINKS = body.LINKS ?? [];
                    body.CONTACTINFOS = [{ TYPE: 'EMAIL', SUBTYPE: 'Work', DETAIL: String(inputs.email) }];
                }
                if (inputs.phone) {
                    body.CONTACTINFOS = [...(body.CONTACTINFOS ?? []), { TYPE: 'PHONE', SUBTYPE: 'Work', DETAIL: String(inputs.phone) }];
                }
                if (inputs.organisationId) body.DEFAULT_LINKED_ORGANISATION = Number(inputs.organisationId);
                if (inputs.title) body.TITLE = String(inputs.title);
                const data = await ins('POST', '/Contacts', body);
                logger.log(`[Insightly] Created contact ${data.CONTACT_ID}`);
                return { output: { contact: data, contactId: String(data.CONTACT_ID) } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = { CONTACT_ID: Number(contactId) };
                if (inputs.firstName) body.FIRST_NAME = String(inputs.firstName);
                if (inputs.lastName) body.LAST_NAME = String(inputs.lastName);
                if (inputs.title) body.TITLE = String(inputs.title);
                if (inputs.phone) {
                    body.CONTACTINFOS = [{ TYPE: 'PHONE', SUBTYPE: 'Work', DETAIL: String(inputs.phone) }];
                }
                const data = await ins('PUT', '/Contacts', body);
                return { output: { contact: data } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await ins('DELETE', `/Contacts/${contactId}`);
                logger.log(`[Insightly] Deleted contact ${contactId}`);
                return { output: { deleted: true, contactId } };
            }

            // Leads
            case 'listLeads': {
                const top = Math.max(1, Math.min(500, Number(inputs.top) || 50));
                const skip = Math.max(0, Number(inputs.skip) || 0);
                const data = await ins('GET', `/Leads?top=${top}&skip=${skip}`);
                return { output: { leads: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const data = await ins('GET', `/Leads/${leadId}`);
                return { output: { lead: data } };
            }

            case 'createLead': {
                const lastName = String(inputs.lastName ?? '').trim();
                if (!lastName) throw new Error('lastName is required.');
                const body: any = { LAST_NAME: lastName };
                if (inputs.firstName) body.FIRST_NAME = String(inputs.firstName);
                if (inputs.email) body.EMAIL = String(inputs.email);
                if (inputs.phone) body.PHONE = String(inputs.phone);
                if (inputs.company) body.ORGANISATION_NAME = String(inputs.company);
                if (inputs.source) body.LEAD_SOURCE = String(inputs.source);
                if (inputs.status) body.LEAD_STATUS = String(inputs.status);
                const data = await ins('POST', '/Leads', body);
                logger.log(`[Insightly] Created lead ${data.LEAD_ID}`);
                return { output: { lead: data, leadId: String(data.LEAD_ID) } };
            }

            case 'updateLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const body: any = { LEAD_ID: Number(leadId) };
                if (inputs.firstName) body.FIRST_NAME = String(inputs.firstName);
                if (inputs.lastName) body.LAST_NAME = String(inputs.lastName);
                if (inputs.email) body.EMAIL = String(inputs.email);
                if (inputs.phone) body.PHONE = String(inputs.phone);
                if (inputs.company) body.ORGANISATION_NAME = String(inputs.company);
                if (inputs.status) body.LEAD_STATUS = String(inputs.status);
                const data = await ins('PUT', '/Leads', body);
                return { output: { lead: data } };
            }

            case 'convertLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const body: any = { LEAD_ID: Number(leadId) };
                if (inputs.createContact !== false) body.CREATE_CONTACT = true;
                if (inputs.createOpportunity) body.CREATE_OPPORTUNITY = true;
                if (inputs.createOrganisation) body.CREATE_ORGANISATION = true;
                const data = await ins('POST', `/Leads/${leadId}/Convert`, body);
                return { output: { conversionResult: data } };
            }

            // Opportunities
            case 'listOpportunities': {
                const top = Math.max(1, Math.min(500, Number(inputs.top) || 50));
                const skip = Math.max(0, Number(inputs.skip) || 0);
                const data = await ins('GET', `/Opportunities?top=${top}&skip=${skip}`);
                return { output: { opportunities: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getOpportunity': {
                const opportunityId = String(inputs.opportunityId ?? '').trim();
                if (!opportunityId) throw new Error('opportunityId is required.');
                const data = await ins('GET', `/Opportunities/${opportunityId}`);
                return { output: { opportunity: data } };
            }

            case 'createOpportunity': {
                const name = String(inputs.name ?? '').trim();
                const closeDate = String(inputs.closeDate ?? '').trim();
                if (!name || !closeDate) throw new Error('name and closeDate are required.');
                const body: any = { OPPORTUNITY_NAME: name, CLOSE_DATE: closeDate };
                if (inputs.value !== undefined) body.BID_AMOUNT = Number(inputs.value);
                if (inputs.currency) body.BID_CURRENCY = String(inputs.currency);
                if (inputs.stageId) body.STAGE_ID = Number(inputs.stageId);
                if (inputs.probability !== undefined) body.PROBABILITY = Number(inputs.probability);
                if (inputs.responsibleUserId) body.RESPONSIBLE_USER_ID = Number(inputs.responsibleUserId);
                const data = await ins('POST', '/Opportunities', body);
                logger.log(`[Insightly] Created opportunity ${data.OPPORTUNITY_ID}`);
                return { output: { opportunity: data, opportunityId: String(data.OPPORTUNITY_ID) } };
            }

            // Projects
            case 'listProjects': {
                const top = Math.max(1, Math.min(500, Number(inputs.top) || 50));
                const skip = Math.max(0, Number(inputs.skip) || 0);
                const data = await ins('GET', `/Projects?top=${top}&skip=${skip}`);
                return { output: { projects: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await ins('GET', `/Projects/${projectId}`);
                return { output: { project: data } };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { PROJECT_NAME: name };
                if (inputs.status) body.STATUS = String(inputs.status);
                if (inputs.description) body.PROJECT_DETAILS = String(inputs.description);
                if (inputs.responsibleUserId) body.RESPONSIBLE_USER_ID = Number(inputs.responsibleUserId);
                if (inputs.startDate) body.STARTED_DATE = String(inputs.startDate);
                if (inputs.completedDate) body.COMPLETED_DATE = String(inputs.completedDate);
                const data = await ins('POST', '/Projects', body);
                logger.log(`[Insightly] Created project ${data.PROJECT_ID}`);
                return { output: { project: data, projectId: String(data.PROJECT_ID) } };
            }

            // Organisations
            case 'listOrganizations': {
                const top = Math.max(1, Math.min(500, Number(inputs.top) || 50));
                const skip = Math.max(0, Number(inputs.skip) || 0);
                const data = await ins('GET', `/Organisations?top=${top}&skip=${skip}`);
                return { output: { organizations: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'createOrganization': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { ORGANISATION_NAME: name };
                if (inputs.phone) body.PHONE = String(inputs.phone);
                if (inputs.website) body.WEBSITE = String(inputs.website);
                if (inputs.industry) body.INDUSTRY = String(inputs.industry);
                if (inputs.numberOfEmployees !== undefined) body.NUMBER_OF_EMPLOYEES = Number(inputs.numberOfEmployees);
                const data = await ins('POST', '/Organisations', body);
                logger.log(`[Insightly] Created organization ${data.ORGANISATION_ID}`);
                return { output: { organization: data, organizationId: String(data.ORGANISATION_ID) } };
            }

            default:
                return { error: `Insightly action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Insightly action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}
