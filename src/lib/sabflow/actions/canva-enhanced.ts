'use server';

export async function executeCanvaEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.canva.com/rest/v1';
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
            case 'listDesigns':
                url = `${BASE}/designs`;
                if (inputs.query) url += `?query=${encodeURIComponent(inputs.query)}`;
                break;

            case 'getDesign':
                url = `${BASE}/designs/${inputs.designId}`;
                break;

            case 'createDesign':
                url = `${BASE}/designs`;
                method = 'POST';
                body = JSON.stringify({
                    design_type: inputs.designType || { type: 'preset', name: inputs.presetName || 'doc' },
                    title: inputs.title || '',
                });
                break;

            case 'updateDesign':
                url = `${BASE}/designs/${inputs.designId}`;
                method = 'PATCH';
                body = JSON.stringify({ title: inputs.title });
                break;

            case 'deleteDesign':
                url = `${BASE}/designs/${inputs.designId}`;
                method = 'DELETE';
                break;

            case 'exportDesign':
                url = `${BASE}/exports`;
                method = 'POST';
                body = JSON.stringify({
                    design_id: inputs.designId,
                    format: inputs.format || 'pdf',
                    export_quality: inputs.exportQuality || 'regular',
                });
                break;

            case 'listBrands':
                url = `${BASE}/brand-templates`;
                break;

            case 'getBrand':
                url = `${BASE}/brand-templates/${inputs.brandId}`;
                break;

            case 'listTemplates':
                url = `${BASE}/design-types/${inputs.designType || 'doc'}/templates`;
                break;

            case 'getTemplate':
                url = `${BASE}/design-types/${inputs.designType || 'doc'}/templates/${inputs.templateId}`;
                break;

            case 'listFolders':
                url = `${BASE}/folders`;
                if (inputs.folderId) url += `?folder_id=${inputs.folderId}`;
                break;

            case 'createFolder':
                url = `${BASE}/folders`;
                method = 'POST';
                body = JSON.stringify({ name: inputs.name, parent_folder_id: inputs.parentFolderId || 'root' });
                break;

            case 'deleteFolder':
                url = `${BASE}/folders/${inputs.folderId}`;
                method = 'DELETE';
                break;

            case 'listAssets':
                url = `${BASE}/assets`;
                if (inputs.folderId) url += `?folder_id=${inputs.folderId}`;
                break;

            case 'uploadAsset':
                url = `${BASE}/asset-uploads`;
                method = 'POST';
                body = JSON.stringify({
                    name: inputs.name,
                    import_type: inputs.importType || 'url',
                    url: inputs.url,
                });
                break;

            default:
                return { error: `Unknown Canva Enhanced action: ${actionName}` };
        }

        const response = await fetch(url, {
            method,
            headers,
            ...(body ? { body } : {}),
        });

        if (response.status === 204) {
            logger.log(`Canva Enhanced [${actionName}] succeeded (no content)`);
            return { output: { success: true } };
        }

        const data = await response.json();

        if (!response.ok) {
            logger.log(`Canva Enhanced API error [${actionName}]: ${response.status}`, data);
            return { error: data.message || data.error?.message || `Canva API error: ${response.status}` };
        }

        logger.log(`Canva Enhanced [${actionName}] succeeded`);
        return { output: data };
    } catch (err: any) {
        logger.log(`Canva Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Canva Enhanced action failed' };
    }
}
