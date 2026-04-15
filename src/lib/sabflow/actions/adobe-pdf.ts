'use server';

export async function executeAdobePdfAction(actionName: string, inputs: any, user: any, logger: any) {
    const accessToken = inputs.accessToken;
    const baseUrl = 'https://pdf-services.adobe.io';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-API-Key': inputs.clientId || '',
    };

    try {
        switch (actionName) {
            case 'createPdf': {
                const res = await fetch(`${baseUrl}/operation/createpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        documentLanguage: inputs.documentLanguage || 'en-US',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'exportPdf': {
                const res = await fetch(`${baseUrl}/operation/exportpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        targetFormat: inputs.targetFormat || 'docx',
                        ocrLang: inputs.ocrLang,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'combinePdf': {
                const res = await fetch(`${baseUrl}/operation/combinepdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assets: inputs.assets || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'splitPdf': {
                const res = await fetch(`${baseUrl}/operation/splitpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        splitoption: inputs.splitOption || { pageCount: inputs.pageCount || 1 },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'compressPdf': {
                const res = await fetch(`${baseUrl}/operation/compresspdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        compressionLevel: inputs.compressionLevel || 'MEDIUM',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'protectPdf': {
                const res = await fetch(`${baseUrl}/operation/protectpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        passwordProtection: {
                            userPassword: inputs.userPassword,
                            ownerPassword: inputs.ownerPassword,
                            encryptionAlgorithm: inputs.encryptionAlgorithm || 'AES_256',
                            contentEncryption: inputs.contentEncryption || 'ALL_CONTENT',
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'removeProtection': {
                const res = await fetch(`${baseUrl}/operation/removeprotection`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        password: inputs.password,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'rotatePages': {
                const res = await fetch(`${baseUrl}/operation/rotatepages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        pageRanges: inputs.pageRanges || [],
                        rotation: inputs.rotation || 90,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'reorderPages': {
                const res = await fetch(`${baseUrl}/operation/reorderpages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        pageRanges: inputs.pageRanges || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'deletePages': {
                const res = await fetch(`${baseUrl}/operation/deletepages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        pageRanges: inputs.pageRanges || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'insertPages': {
                const res = await fetch(`${baseUrl}/operation/insertpages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        base: { assetID: inputs.baseAssetID },
                        input: inputs.insertInput || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'extractText': {
                const res = await fetch(`${baseUrl}/operation/extractpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        elementsToExtract: inputs.elementsToExtract || ['text'],
                        tableOutputFormat: inputs.tableOutputFormat || 'xlsx',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'extractImages': {
                const res = await fetch(`${baseUrl}/operation/extractpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        elementsToExtract: ['text', 'tables'],
                        renditionsToExtract: inputs.renditionsToExtract || ['figures'],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'ocrPdf': {
                const res = await fetch(`${baseUrl}/operation/ocr`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        ocrLang: inputs.ocrLang || 'en-US',
                        ocrType: inputs.ocrType || 'GENERATE_SEARCHABLE_IMAGE',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            case 'convertToWord': {
                const res = await fetch(`${baseUrl}/operation/exportpdf`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        assetID: inputs.assetID,
                        targetFormat: 'docx',
                        exportOCRLocale: inputs.locale || 'en-US',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }
            default:
                return { error: `Unknown Adobe PDF action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Adobe PDF action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Adobe PDF action' };
    }
}
