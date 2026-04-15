'use server';

export async function executeZeplinAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.zeplin.io/v2';
    const token = inputs.accessToken;

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'listProjects':
                url = `${BASE}/projects`;
                if (inputs.workspaceId) url += `?workspace.id=${inputs.workspaceId}`;
                break;

            case 'getProject':
                url = `${BASE}/projects/${inputs.projectId}`;
                break;

            case 'listProjectScreens':
                url = `${BASE}/projects/${inputs.projectId}/screens`;
                if (inputs.limit) url += `?limit=${inputs.limit}`;
                if (inputs.offset) url += `${url.includes('?') ? '&' : '?'}offset=${inputs.offset}`;
                break;

            case 'getProjectScreen':
                url = `${BASE}/projects/${inputs.projectId}/screens/${inputs.screenId}`;
                break;

            case 'listStyleguides':
                url = `${BASE}/styleguides`;
                if (inputs.workspaceId) url += `?workspace.id=${inputs.workspaceId}`;
                break;

            case 'getStyleguide':
                url = `${BASE}/styleguides/${inputs.styleguideId}`;
                break;

            case 'listColors':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/colors`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/colors`;
                }
                break;

            case 'createColor':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/colors`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/colors`;
                }
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    r: inputs.r,
                    g: inputs.g,
                    b: inputs.b,
                    a: inputs.a !== undefined ? inputs.a : 1,
                });
                break;

            case 'listTextStyles':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/text_styles`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/text_styles`;
                }
                break;

            case 'createTextStyle':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/text_styles`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/text_styles`;
                }
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    font_family: inputs.fontFamily,
                    font_size: inputs.fontSize,
                    font_weight: inputs.fontWeight || 400,
                    line_height: inputs.lineHeight,
                    letter_spacing: inputs.letterSpacing,
                });
                break;

            case 'listSpacings':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/spacing_tokens`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/spacing_tokens`;
                }
                break;

            case 'listComponents':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/components`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/components`;
                }
                break;

            case 'getComponent':
                if (inputs.styleguideId) {
                    url = `${BASE}/styleguides/${inputs.styleguideId}/components/${inputs.componentId}`;
                } else {
                    url = `${BASE}/projects/${inputs.projectId}/components/${inputs.componentId}`;
                }
                break;

            case 'listProjectMembers':
                url = `${BASE}/projects/${inputs.projectId}/members`;
                break;

            case 'listOrganizations':
                url = `${BASE}/organizations`;
                break;

            default:
                return { error: `Unknown Zeplin action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            ...(body ? { body } : {}),
        });

        if (response.status === 204) {
            logger.log(`Zeplin [${actionName}] succeeded (no content)`);
            return { output: { success: true } };
        }

        const data = await response.json();

        if (!response.ok) {
            logger.log(`Zeplin API error [${actionName}]: ${response.status}`, data);
            return { error: data.message || data.detail || `Zeplin API error: ${response.status}` };
        }

        logger.log(`Zeplin [${actionName}] succeeded`);
        return { output: data };
    } catch (err: any) {
        logger.log(`Zeplin action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Zeplin action failed' };
    }
}
