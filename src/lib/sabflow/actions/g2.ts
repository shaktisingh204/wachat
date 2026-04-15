'use server';

export async function executeG2Action(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const BASE_URL = 'https://data.g2.com/api/v1';
        const apiToken = inputs.apiToken;

        const headers: Record<string, string> = {
            Authorization: `Token token=${apiToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listReviews': {
                const params = new URLSearchParams();
                if (inputs.productId) params.set('product_id', inputs.productId);
                if (inputs.page) params.set('page[number]', inputs.page);
                if (inputs.perPage) params.set('page[size]', inputs.perPage);
                const res = await fetch(`${BASE_URL}/reviews?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getReview': {
                const res = await fetch(`${BASE_URL}/reviews/${inputs.reviewId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', inputs.page);
                if (inputs.perPage) params.set('page[size]', inputs.perPage);
                const res = await fetch(`${BASE_URL}/products?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${BASE_URL}/products/${inputs.productId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listCompetitors': {
                const params = new URLSearchParams();
                if (inputs.productId) params.set('product_id', inputs.productId);
                const res = await fetch(`${BASE_URL}/competitors?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getCompetitor': {
                const res = await fetch(`${BASE_URL}/competitors/${inputs.competitorId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listCategories': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page[number]', inputs.page);
                if (inputs.perPage) params.set('page[size]', inputs.perPage);
                const res = await fetch(`${BASE_URL}/categories?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getCategory': {
                const res = await fetch(`${BASE_URL}/categories/${inputs.categoryId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listCompanyReviews': {
                const params = new URLSearchParams();
                if (inputs.companyId) params.set('company_id', inputs.companyId);
                if (inputs.page) params.set('page[number]', inputs.page);
                if (inputs.perPage) params.set('page[size]', inputs.perPage);
                const res = await fetch(`${BASE_URL}/reviews?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getReviewSentiment': {
                const res = await fetch(`${BASE_URL}/reviews/${inputs.reviewId}/sentiments`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listSurveyResponses': {
                const params = new URLSearchParams();
                if (inputs.surveyId) params.set('survey_id', inputs.surveyId);
                if (inputs.page) params.set('page[number]', inputs.page);
                if (inputs.perPage) params.set('page[size]', inputs.perPage);
                const res = await fetch(`${BASE_URL}/survey_responses?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getSurveyResponse': {
                const res = await fetch(`${BASE_URL}/survey_responses/${inputs.surveyResponseId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.detail || data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `G2 action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger.log(`G2 action error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeG2Action' };
    }
}
