'use server';

export async function executeZoomWebinarAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.zoom.us/v2';

        const zoomFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${inputs.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Zoom Webinar API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'listWebinars': {
                const userId = inputs.userId || 'me';
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                if (inputs.pageNumber) params.set('page_number', inputs.pageNumber);
                const data = await zoomFetch('GET', `/users/${userId}/webinars?${params}`);
                return { output: data };
            }
            case 'getWebinar': {
                const data = await zoomFetch('GET', `/webinars/${inputs.webinarId}`);
                return { output: data };
            }
            case 'createWebinar': {
                const userId = inputs.userId || 'me';
                const body: any = {
                    topic: inputs.topic,
                    type: inputs.type ?? 5,
                    start_time: inputs.startTime,
                    duration: inputs.duration,
                    timezone: inputs.timezone,
                    password: inputs.password,
                    agenda: inputs.agenda,
                    settings: inputs.settings,
                };
                const data = await zoomFetch('POST', `/users/${userId}/webinars`, body);
                return { output: data };
            }
            case 'updateWebinar': {
                const body: any = {
                    topic: inputs.topic,
                    type: inputs.type,
                    start_time: inputs.startTime,
                    duration: inputs.duration,
                    timezone: inputs.timezone,
                    password: inputs.password,
                    agenda: inputs.agenda,
                    settings: inputs.settings,
                };
                await zoomFetch('PATCH', `/webinars/${inputs.webinarId}`, body);
                return { output: { success: true, webinarId: inputs.webinarId } };
            }
            case 'deleteWebinar': {
                await zoomFetch('DELETE', `/webinars/${inputs.webinarId}`);
                return { output: { success: true, webinarId: inputs.webinarId } };
            }
            case 'listRegistrants': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.pageSize) params.set('page_size', inputs.pageSize);
                if (inputs.pageNumber) params.set('page_number', inputs.pageNumber);
                const data = await zoomFetch('GET', `/webinars/${inputs.webinarId}/registrants?${params}`);
                return { output: data };
            }
            case 'getRegistrant': {
                const data = await zoomFetch('GET', `/webinars/${inputs.webinarId}/registrants/${inputs.registrantId}`);
                return { output: data };
            }
            case 'addRegistrant': {
                const body: any = {
                    email: inputs.email,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    address: inputs.address,
                    city: inputs.city,
                    country: inputs.country,
                    zip: inputs.zip,
                    state: inputs.state,
                    phone: inputs.phone,
                    industry: inputs.industry,
                    org: inputs.org,
                    job_title: inputs.jobTitle,
                    purchasing_time_frame: inputs.purchasingTimeFrame,
                    role_in_purchase_process: inputs.roleInPurchaseProcess,
                    no_of_employees: inputs.noOfEmployees,
                    comments: inputs.comments,
                    custom_questions: inputs.customQuestions,
                };
                const data = await zoomFetch('POST', `/webinars/${inputs.webinarId}/registrants`, body);
                return { output: data };
            }
            case 'removeRegistrant': {
                await zoomFetch('DELETE', `/webinars/${inputs.webinarId}/registrants/${inputs.registrantId}`);
                return { output: { success: true, registrantId: inputs.registrantId } };
            }
            case 'listPanelists': {
                const data = await zoomFetch('GET', `/webinars/${inputs.webinarId}/panelists`);
                return { output: data };
            }
            case 'addPanelist': {
                const body = {
                    panelists: inputs.panelists ?? [{ email: inputs.email, name: inputs.name }],
                };
                const data = await zoomFetch('POST', `/webinars/${inputs.webinarId}/panelists`, body);
                return { output: data };
            }
            case 'removePanelist': {
                await zoomFetch('DELETE', `/webinars/${inputs.webinarId}/panelists/${inputs.panelistId}`);
                return { output: { success: true, panelistId: inputs.panelistId } };
            }
            case 'listPolls': {
                const data = await zoomFetch('GET', `/webinars/${inputs.webinarId}/polls`);
                return { output: data };
            }
            case 'createPoll': {
                const body = {
                    title: inputs.title,
                    questions: inputs.questions,
                    anonymous: inputs.anonymous ?? false,
                    poll_type: inputs.pollType ?? 1,
                };
                const data = await zoomFetch('POST', `/webinars/${inputs.webinarId}/polls`, body);
                return { output: data };
            }
            case 'getWebinarReport': {
                const data = await zoomFetch('GET', `/report/webinars/${inputs.webinarId}`);
                return { output: data };
            }
            default:
                return { error: `Zoom Webinar: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Zoom Webinar action error: ${err.message}`);
        return { error: err.message };
    }
}
