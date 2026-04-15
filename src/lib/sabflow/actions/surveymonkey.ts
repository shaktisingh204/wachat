'use server';

async function surveyMonkeyFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[SurveyMonkey] ${method} ${path}`);
    const BASE = 'https://api.surveymonkey.com/v3';
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data?.error?.message ?? data?.message ?? `SurveyMonkey API error: ${res.status}`
        );
    }
    return data;
}

export async function executeSurveymonkeyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const sm = (method: string, path: string, body?: any) =>
            surveyMonkeyFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getSurveys': {
                const params = new URLSearchParams();
                params.set('page', String(inputs.page ?? 1));
                params.set('per_page', String(inputs.perPage ?? 50));
                if (inputs.title) params.set('title', String(inputs.title));
                const data = await sm('GET', `/surveys?${params.toString()}`);
                return {
                    output: {
                        data: data.data ?? [],
                        total: data.total ?? 0,
                        count: data.count ?? 0,
                    },
                };
            }

            case 'getSurvey': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const data = await sm('GET', `/surveys/${surveyId}`);
                return {
                    output: {
                        id: String(data.id ?? surveyId),
                        title: data.title ?? '',
                        pageCount: String(data.page_count ?? 0),
                        questionCount: String(data.question_count ?? 0),
                        responseCount: String(data.response_count ?? 0),
                    },
                };
            }

            case 'getSurveyDetails': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const data = await sm('GET', `/surveys/${surveyId}/details`);
                return {
                    output: {
                        id: String(data.id ?? surveyId),
                        title: data.title ?? '',
                        pages: data.pages ?? [],
                    },
                };
            }

            case 'createSurvey': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: Record<string, any> = {
                    title,
                    language: String(inputs.languageCode ?? 'en'),
                };
                if (inputs.category) body.category = String(inputs.category);
                const data = await sm('POST', '/surveys', body);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        title: data.title ?? title,
                        href: data.href ?? '',
                    },
                };
            }

            case 'deleteSurvey': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                await sm('DELETE', `/surveys/${surveyId}`);
                return { output: { deleted: true } };
            }

            case 'getResponses': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const completed = inputs.completed === true || inputs.completed === 'true';
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (completed) params.set('completion_status', 'completed');
                const endpoint = completed
                    ? `/surveys/${surveyId}/responses/bulk?${params.toString()}`
                    : `/surveys/${surveyId}/responses?${params.toString()}`;
                const data = await sm('GET', endpoint);
                return {
                    output: {
                        data: data.data ?? [],
                        total: data.total ?? 0,
                    },
                };
            }

            case 'getResponse': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                const responseId = String(inputs.responseId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                if (!responseId) throw new Error('responseId is required.');
                const data = await sm('GET', `/surveys/${surveyId}/responses/${responseId}/details`);
                const answers = (data.pages ?? []).flatMap((p: any) =>
                    (p.questions ?? []).map((q: any) => ({
                        questionId: String(q.id ?? ''),
                        rows: (q.answers ?? []).map((a: any) => ({ text: a.text ?? a.other_id ?? '' })),
                    }))
                );
                return {
                    output: {
                        id: String(data.id ?? responseId),
                        surveyId: String(data.survey_id ?? surveyId),
                        answers,
                    },
                };
            }

            case 'createResponse': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                if (!inputs.pages) throw new Error('pages is required.');
                const data = await sm('POST', `/surveys/${surveyId}/responses`, { pages: inputs.pages });
                return {
                    output: {
                        id: String(data.id ?? ''),
                        surveyId: String(data.survey_id ?? surveyId),
                    },
                };
            }

            case 'createCollector': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const body: Record<string, any> = {
                    type: String(inputs.type ?? 'weblink'),
                };
                if (inputs.name) body.name = String(inputs.name);
                const data = await sm('POST', `/surveys/${surveyId}/collectors`, body);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        url: data.url ?? '',
                    },
                };
            }

            case 'getCollectors': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                const data = await sm('GET', `/surveys/${surveyId}/collectors`);
                return { output: { data: data.data ?? [] } };
            }

            case 'sendEmail': {
                const surveyId = String(inputs.surveyId ?? '').trim();
                const collectorId = String(inputs.collectorId ?? '').trim();
                const to = inputs.to;
                const subject = String(inputs.subject ?? '').trim();
                const bodyText = String(inputs.bodyText ?? '').trim();
                if (!surveyId) throw new Error('surveyId is required.');
                if (!collectorId) throw new Error('collectorId is required.');
                if (!to) throw new Error('to (email address) is required.');
                if (!subject) throw new Error('subject is required.');

                const recipients = Array.isArray(to)
                    ? to.map((email: string) => ({ email: String(email) }))
                    : [{ email: String(to) }];

                const data = await sm('POST', `/collectors/${collectorId}/messages`, {
                    type: 'invite',
                    subject,
                    body_text: bodyText,
                    recipients,
                });
                return { output: { id: String(data.id ?? '') } };
            }

            case 'getUser': {
                const data = await sm('GET', '/users/me');
                return {
                    output: {
                        id: String(data.id ?? ''),
                        username: data.username ?? '',
                        email: data.email ?? '',
                        firstName: data.first_name ?? '',
                        lastName: data.last_name ?? '',
                    },
                };
            }

            default:
                return { error: `SurveyMonkey action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger?.log(`[SurveyMonkey] Error in ${actionName}: ${e.message}`);
        return { error: e.message || 'SurveyMonkey action failed.' };
    }
}
