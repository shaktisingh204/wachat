'use server';

export async function executeApitemioAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey } = inputs;
        if (!apiKey) return { error: 'APITemplate.io: apiKey is required.' };

        const BASE = 'https://rest.apitemplate.io/v2';

        const headers: Record<string, string> = {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json',
        };

        const apiGet = async (path: string): Promise<any> => {
            logger.log(`APITemplate.io GET ${path}`);
            const res = await fetch(`${BASE}${path}`, { method: 'GET', headers });
            const text = await res.text();
            if (!res.ok) throw new Error(`APITemplate.io GET ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        const apiPost = async (path: string, body: any): Promise<any> => {
            logger.log(`APITemplate.io POST ${path}`);
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`APITemplate.io POST ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        const apiDelete = async (path: string): Promise<any> => {
            logger.log(`APITemplate.io DELETE ${path}`);
            const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers });
            const text = await res.text();
            if (!res.ok) throw new Error(`APITemplate.io DELETE ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createPdf': {
                const { templateId, data, expiration, exportType, filename } = inputs;
                if (!templateId) return { error: 'APITemplate.io createPdf: templateId is required.' };
                if (!data) return { error: 'APITemplate.io createPdf: data is required.' };

                const params = new URLSearchParams({
                    template_id: String(templateId),
                    expiration: String(expiration ?? 1),
                    export_type: exportType ?? 'json',
                });
                if (filename) params.set('filename', filename);

                const result = await apiPost(`/create-pdf?${params.toString()}`, data);
                return {
                    output: {
                        download_url: result.download_url,
                        transaction_ref: result.transaction_ref,
                        status: result.status,
                    },
                };
            }

            case 'createPdfFromHtml': {
                const { htmlContent, data, margin, paperSize, landscape, headerHtml, footerHtml } = inputs;
                if (!htmlContent) return { error: 'APITemplate.io createPdfFromHtml: htmlContent is required.' };

                const body: any = {
                    html: htmlContent,
                    settings: {
                        paper_size: paperSize ?? 'A4',
                        landscape: landscape ?? false,
                        print_header: headerHtml ?? '',
                        print_footer: footerHtml ?? '',
                    },
                };
                if (data) body.data = data;
                if (margin) body.settings.margin = margin;

                const result = await apiPost('/create-pdf-from-html', body);
                return { output: { download_url: result.download_url, transaction_ref: result.transaction_ref } };
            }

            case 'createPdfFromUrl': {
                const { url, data, margin, paperSize } = inputs;
                if (!url) return { error: 'APITemplate.io createPdfFromUrl: url is required.' };

                const body: any = {
                    url,
                    settings: { paper_size: paperSize ?? 'A4' },
                };
                if (data) body.data = data;
                if (margin) body.settings.margin = margin;

                const result = await apiPost('/create-pdf-from-url', body);
                return { output: { download_url: result.download_url } };
            }

            case 'createImage': {
                const { templateId, data, expiration } = inputs;
                if (!templateId) return { error: 'APITemplate.io createImage: templateId is required.' };
                if (!data) return { error: 'APITemplate.io createImage: data is required.' };

                const params = new URLSearchParams({
                    template_id: String(templateId),
                    expiration: String(expiration ?? 1),
                });
                const result = await apiPost(`/create-image?${params.toString()}`, data);
                return { output: { download_url: result.download_url, status: result.status } };
            }

            case 'listTemplates': {
                const { format } = inputs;
                const params = format ? `?format=${encodeURIComponent(format)}` : '';
                const result = await apiGet(`/list-templates${params}`);
                const templates = (result.templates ?? result ?? []).map((t: any) => ({
                    template_id: t.template_id,
                    name: t.name,
                    format: t.format,
                    created_at: t.created_at,
                }));
                return { output: { templates } };
            }

            case 'getTemplate': {
                const { templateId } = inputs;
                if (!templateId) return { error: 'APITemplate.io getTemplate: templateId is required.' };
                const result = await apiGet(`/get-template?template_id=${encodeURIComponent(templateId)}`);
                return { output: { template: result.template ?? result } };
            }

            case 'deleteTemplate': {
                const { templateId } = inputs;
                if (!templateId) return { error: 'APITemplate.io deleteTemplate: templateId is required.' };
                const result = await apiDelete(`/delete-template?template_id=${encodeURIComponent(templateId)}`);
                return { output: { message: result.message ?? 'Template deleted.' } };
            }

            case 'getPdfTransaction': {
                const { transactionRef } = inputs;
                if (!transactionRef) return { error: 'APITemplate.io getPdfTransaction: transactionRef is required.' };
                const result = await apiGet(`/get-pdf-transaction?transaction_ref=${encodeURIComponent(transactionRef)}`);
                return {
                    output: {
                        download_url: result.download_url,
                        status: result.status,
                        created_at: result.created_at,
                    },
                };
            }

            case 'listTransactions': {
                const { page, limit } = inputs;
                const params = new URLSearchParams({
                    page: String(page ?? 1),
                    limit: String(limit ?? 20),
                });
                const result = await apiGet(`/list-transactions?${params.toString()}`);
                const transactions = (result.transactions ?? result ?? []).map((t: any) => ({
                    transaction_ref: t.transaction_ref,
                    template_id: t.template_id,
                    created_at: t.created_at,
                    download_url: t.download_url,
                }));
                return { output: { transactions } };
            }

            case 'getMergedPdfs': {
                const { transactionRefs } = inputs;
                if (!transactionRefs || !Array.isArray(transactionRefs) || transactionRefs.length === 0) {
                    return { error: 'APITemplate.io getMergedPdfs: transactionRefs array is required.' };
                }
                const result = await apiPost('/merge-pdfs', { transaction_refs: transactionRefs });
                return { output: { download_url: result.download_url } };
            }

            default:
                return { error: `APITemplate.io: unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`APITemplate.io action error: ${err?.message}`);
        return { error: err?.message ?? 'APITemplate.io action failed.' };
    }
}
