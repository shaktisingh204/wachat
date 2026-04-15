'use server';

export async function executeBreezyHRAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.breezy.hr/v3';
        const accessToken = inputs.accessToken;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listCompanies': {
                url = `${baseUrl}/companies`;
                break;
            }
            case 'getCompany': {
                url = `${baseUrl}/company/${inputs.companyId}`;
                break;
            }
            case 'listPositions': {
                const params = new URLSearchParams();
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.page) params.set('page', String(inputs.page));
                url = `${baseUrl}/company/${inputs.companyId}/positions?${params.toString()}`;
                break;
            }
            case 'getPosition': {
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}`;
                break;
            }
            case 'createPosition': {
                method = 'POST';
                url = `${baseUrl}/company/${inputs.companyId}/positions`;
                body = JSON.stringify({
                    name: inputs.name,
                    description: inputs.description,
                    location: inputs.location,
                    department: inputs.department,
                    type: inputs.type || 'full-time',
                    state: inputs.state || 'draft',
                });
                break;
            }
            case 'listCandidates': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidates?${params.toString()}`;
                break;
            }
            case 'getCandidate': {
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidate/${inputs.candidateId}`;
                break;
            }
            case 'createCandidate': {
                method = 'POST';
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidates`;
                body = JSON.stringify({
                    name: inputs.name,
                    email_address: inputs.email,
                    phone_number: inputs.phone,
                    address: inputs.address,
                    summary: inputs.summary,
                    source: inputs.source,
                    origin: inputs.origin || 'sourced',
                });
                break;
            }
            case 'updateCandidate': {
                method = 'PUT';
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidate/${inputs.candidateId}`;
                body = JSON.stringify({
                    name: inputs.name,
                    email_address: inputs.email,
                    phone_number: inputs.phone,
                    summary: inputs.summary,
                });
                break;
            }
            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidates?${params.toString()}`;
                break;
            }
            case 'getApplication': {
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidate/${inputs.candidateId}`;
                break;
            }
            case 'listStages': {
                url = `${baseUrl}/company/${inputs.companyId}/stages`;
                break;
            }
            case 'getStage': {
                url = `${baseUrl}/company/${inputs.companyId}/stage/${inputs.stageId}`;
                break;
            }
            case 'addNote': {
                method = 'POST';
                url = `${baseUrl}/company/${inputs.companyId}/position/${inputs.positionId}/candidate/${inputs.candidateId}/notes`;
                body = JSON.stringify({
                    content: inputs.content,
                    type: inputs.type || 'plain',
                });
                break;
            }
            case 'listPipelines': {
                url = `${baseUrl}/company/${inputs.companyId}/pipelines`;
                break;
            }
            default:
                return { error: `Unknown BreezyHR action: ${actionName}` };
        }

        const fetchOptions: RequestInit = { method, headers };
        if (body !== undefined) fetchOptions.body = body;

        const response = await fetch(url, fetchOptions);
        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!response.ok) {
            return { error: `BreezyHR API error ${response.status}: ${text}` };
        }

        return { output: data };
    } catch (err: any) {
        logger.log(`BreezyHR action error: ${err.message}`);
        return { error: err.message || 'Unknown error in BreezyHR action' };
    }
}
