'use server';

export async function executeFigmaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.figma.com/v1';
    const token = inputs.accessToken;

    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        let url = '';
        let method = 'GET';
        let body: any = undefined;

        switch (actionName) {
            case 'getFile':
                url = `${BASE}/files/${inputs.fileKey}`;
                break;

            case 'getFileNodes':
                url = `${BASE}/files/${inputs.fileKey}/nodes?ids=${encodeURIComponent(inputs.nodeIds)}`;
                break;

            case 'getImages':
                url = `${BASE}/images/${inputs.fileKey}?ids=${encodeURIComponent(inputs.nodeIds)}&format=${inputs.format || 'png'}`;
                break;

            case 'getImageFills':
                url = `${BASE}/files/${inputs.fileKey}/images`;
                break;

            case 'listProjects':
                url = `${BASE}/teams/${inputs.teamId}/projects`;
                break;

            case 'getProject':
                url = `${BASE}/projects/${inputs.projectId}`;
                break;

            case 'getProjectFiles':
                url = `${BASE}/projects/${inputs.projectId}/files`;
                break;

            case 'listTeamProjects':
                url = `${BASE}/teams/${inputs.teamId}/projects`;
                break;

            case 'getComponentSets':
                url = `${BASE}/files/${inputs.fileKey}/component_sets`;
                break;

            case 'getComponents':
                url = `${BASE}/files/${inputs.fileKey}/components`;
                break;

            case 'getStyles':
                url = `${BASE}/files/${inputs.fileKey}/styles`;
                break;

            case 'postComments':
                url = `${BASE}/files/${inputs.fileKey}/comments`;
                method = 'POST';
                body = JSON.stringify({
                    message: inputs.message,
                    client_meta: inputs.clientMeta || {},
                });
                break;

            case 'deleteComment':
                url = `${BASE}/files/${inputs.fileKey}/comments/${inputs.commentId}`;
                method = 'DELETE';
                break;

            case 'getVersions':
                url = `${BASE}/files/${inputs.fileKey}/versions`;
                break;

            case 'createWebhook':
                url = `${BASE}/webhooks`;
                method = 'POST';
                body = JSON.stringify({
                    event_type: inputs.eventType,
                    team_id: inputs.teamId,
                    endpoint: inputs.endpoint,
                    passcode: inputs.passcode || '',
                    description: inputs.description || '',
                });
                break;

            default:
                return { error: `Unknown Figma Enhanced action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            ...(body ? { body } : {}),
        });

        const data = await response.json();

        if (!response.ok) {
            logger.log(`Figma Enhanced API error [${actionName}]: ${response.status}`, data);
            return { error: data.err || data.message || `Figma API error: ${response.status}` };
        }

        logger.log(`Figma Enhanced [${actionName}] succeeded`);
        return { output: data };
    } catch (err: any) {
        logger.log(`Figma Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Figma Enhanced action failed' };
    }
}
