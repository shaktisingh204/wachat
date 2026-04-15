'use server';

export async function executeSurveyMonkeyEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, surveyId, pageId, questionId, responseId, collectorId, ...rest } = inputs;
    const baseUrl = 'https://api.surveymonkey.com/v3';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listSurveys': {
                const params = new URLSearchParams();
                if (rest.page) params.set('page', String(rest.page));
                if (rest.perPage) params.set('per_page', String(rest.perPage));
                const res = await fetch(`${baseUrl}/surveys?${params}`, { headers });
                if (!res.ok) return { error: `SurveyMonkey listSurveys error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getSurvey': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}`, { headers });
                if (!res.ok) return { error: `SurveyMonkey getSurvey error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createSurvey': {
                const body: Record<string, any> = { title: rest.title };
                if (rest.nickname) body.nickname = rest.nickname;
                if (rest.language) body.language = rest.language;
                const res = await fetch(`${baseUrl}/surveys`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `SurveyMonkey createSurvey error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateSurvey': {
                const body: Record<string, any> = {};
                if (rest.title) body.title = rest.title;
                if (rest.nickname) body.nickname = rest.nickname;
                if (rest.language) body.language = rest.language;
                const res = await fetch(`${baseUrl}/surveys/${surveyId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `SurveyMonkey updateSurvey error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteSurvey': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `SurveyMonkey deleteSurvey error: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, surveyId } };
            }

            case 'listPages': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/pages`, { headers });
                if (!res.ok) return { error: `SurveyMonkey listPages error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createPage': {
                const body: Record<string, any> = {};
                if (rest.title) body.title = rest.title;
                if (rest.description) body.description = rest.description;
                if (rest.position) body.position = rest.position;
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/pages`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `SurveyMonkey createPage error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listQuestions': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/pages/${pageId}/questions`, { headers });
                if (!res.ok) return { error: `SurveyMonkey listQuestions error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createQuestion': {
                const body: Record<string, any> = {
                    family: rest.family || 'single_choice',
                    subtype: rest.subtype || 'vertical',
                    headings: [{ heading: rest.heading || rest.question }],
                };
                if (rest.answers) body.answers = rest.answers;
                if (rest.position) body.position = rest.position;
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/pages/${pageId}/questions`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `SurveyMonkey createQuestion error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listResponses': {
                const params = new URLSearchParams();
                if (rest.page) params.set('page', String(rest.page));
                if (rest.perPage) params.set('per_page', String(rest.perPage));
                if (rest.startCreatedAt) params.set('start_created_at', rest.startCreatedAt);
                if (rest.endCreatedAt) params.set('end_created_at', rest.endCreatedAt);
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/responses?${params}`, { headers });
                if (!res.ok) return { error: `SurveyMonkey listResponses error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getResponse': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/responses/${responseId}`, { headers });
                if (!res.ok) return { error: `SurveyMonkey getResponse error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getResponseDetails': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/responses/${responseId}/details`, { headers });
                if (!res.ok) return { error: `SurveyMonkey getResponseDetails error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getResponseCount': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/responses/bulk?per_page=1`, { headers });
                if (!res.ok) return { error: `SurveyMonkey getResponseCount error: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { total: data.total } };
            }

            case 'getSurveyRollup': {
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/rollups`, { headers });
                if (!res.ok) return { error: `SurveyMonkey getSurveyRollup error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listCollectors': {
                const params = new URLSearchParams();
                if (rest.page) params.set('page', String(rest.page));
                if (rest.perPage) params.set('per_page', String(rest.perPage));
                const res = await fetch(`${baseUrl}/surveys/${surveyId}/collectors?${params}`, { headers });
                if (!res.ok) return { error: `SurveyMonkey listCollectors error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `SurveyMonkey Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
