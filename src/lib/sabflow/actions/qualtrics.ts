'use server';

export async function executeQualtricsAction(actionName: string, inputs: any, user: any, logger: any) {
    const { apiToken, dataCenter, surveyId, responseId, exportProgressId, fileId, distributionId, mailingListId, contactId, ...rest } = inputs;
    const baseUrl = `https://${dataCenter}.qualtrics.com/API/v3`;

    const headers: Record<string, string> = {
        'X-API-TOKEN': apiToken,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listSurveys': {
                const params = new URLSearchParams();
                if (rest.offset) params.set('offset', String(rest.offset));
                const res = await fetch(`${baseUrl}/surveys?${params}`, { headers });
                if (!res.ok) return { error: `Qualtrics listSurveys error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getSurvey': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}`, { headers });
                if (!res.ok) return { error: `Qualtrics getSurvey error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createSurvey': {
                const body: Record<string, any> = {
                    SurveyName: rest.surveyName,
                    Language: rest.language || 'EN',
                    ProjectCategory: rest.projectCategory || 'CORE',
                };
                const res = await fetch(`${baseUrl}/surveys`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Qualtrics createSurvey error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteSurvey': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Qualtrics deleteSurvey error: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, surveyId } };
            }

            case 'listResponses': {
                const params = new URLSearchParams();
                if (rest.startDate) params.set('startDate', rest.startDate);
                if (rest.endDate) params.set('endDate', rest.endDate);
                if (rest.limit) params.set('limit', String(rest.limit));
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/responses?${params}`, { headers });
                if (!res.ok) return { error: `Qualtrics listResponses error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getResponse': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/responses/${responseId}`, { headers });
                if (!res.ok) return { error: `Qualtrics getResponse error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'exportResponses': {
                const body: Record<string, any> = {
                    format: rest.format || 'json',
                };
                if (rest.startDate) body.startDate = rest.startDate;
                if (rest.endDate) body.endDate = rest.endDate;
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/export-responses`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Qualtrics exportResponses error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getExportProgress': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/export-responses/${exportProgressId}`, { headers });
                if (!res.ok) return { error: `Qualtrics getExportProgress error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getExportFile': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/export-responses/${fileId}/file`, { headers });
                if (!res.ok) return { error: `Qualtrics getExportFile error: ${res.status} ${await res.text()}` };
                return { output: { fileUrl: res.url, status: res.status } };
            }

            case 'createDistribution': {
                const body: Record<string, any> = {
                    surveyId,
                    mailingListId: rest.mailingListId,
                    fromEmail: rest.fromEmail,
                    fromName: rest.fromName,
                    replyToEmail: rest.replyToEmail,
                    subject: rest.subject,
                    message: rest.message,
                    sendDate: rest.sendDate,
                    expirationDate: rest.expirationDate,
                };
                const res = await fetch(`${baseUrl}/distributions`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Qualtrics createDistribution error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listDistributions': {
                const params = new URLSearchParams({ surveyId });
                if (rest.distributionRequestType) params.set('distributionRequestType', rest.distributionRequestType);
                const res = await fetch(`${baseUrl}/distributions?${params}`, { headers });
                if (!res.ok) return { error: `Qualtrics listDistributions error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getDistribution': {
                const params = new URLSearchParams({ surveyId });
                const res = await fetch(`${baseUrl}/distributions/${distributionId}?${params}`, { headers });
                if (!res.ok) return { error: `Qualtrics getDistribution error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createContactList': {
                const body: Record<string, any> = {
                    name: rest.name,
                };
                if (rest.libraryId) body.libraryId = rest.libraryId;
                const res = await fetch(`${baseUrl}/mailinglists`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Qualtrics createContactList error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listContactLists': {
                const res = await fetch(`${baseUrl}/mailinglists`, { headers });
                if (!res.ok) return { error: `Qualtrics listContactLists error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (rest.skipToken) params.set('skipToken', rest.skipToken);
                const res = await fetch(`${baseUrl}/mailinglists/${mailingListId}/contacts?${params}`, { headers });
                if (!res.ok) return { error: `Qualtrics listContacts error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Qualtrics: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
