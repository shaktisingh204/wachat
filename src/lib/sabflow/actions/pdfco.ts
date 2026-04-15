'use server';

export async function executePdfcoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey } = inputs;
        if (!apiKey) return { error: 'PDF.co: apiKey is required.' };

        const BASE = 'https://api.pdf.co/v1';

        const headers: Record<string, string> = {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
        };

        const pdfGet = async (path: string): Promise<any> => {
            logger.log(`PDF.co GET ${path}`);
            const res = await fetch(`${BASE}${path}`, { method: 'GET', headers });
            const text = await res.text();
            if (!res.ok) throw new Error(`PDF.co GET ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        const pdfPost = async (path: string, body: any): Promise<any> => {
            logger.log(`PDF.co POST ${path}`);
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`PDF.co POST ${path} failed (${res.status}): ${text}`);
            const data = text ? JSON.parse(text) : {};
            if (data.error) throw new Error(`PDF.co error: ${data.message ?? JSON.stringify(data)}`);
            return data;
        };

        switch (actionName) {
            case 'pdfToText': {
                const { url, pages, inline } = inputs;
                if (!url) return { error: 'PDF.co pdfToText: url is required.' };
                const data = await pdfPost('/pdf/convert/to/text', {
                    url,
                    pages: pages ?? '',
                    inline: inline ?? false,
                    async: false,
                });
                return { output: { body: data.body, pageCount: data.pageCount, url: data.url, credits: data.credits } };
            }

            case 'pdfToJson': {
                const { url, pages } = inputs;
                if (!url) return { error: 'PDF.co pdfToJson: url is required.' };
                const data = await pdfPost('/pdf/convert/to/json', {
                    url,
                    pages: pages ?? '',
                    async: false,
                });
                return { output: { body: data.body, url: data.url, credits: data.credits } };
            }

            case 'htmlToPdf': {
                const { url, html, name, margin } = inputs;
                if (!url && !html) return { error: 'PDF.co htmlToPdf: url or html is required.' };
                const body: any = {
                    name: name ?? 'result.pdf',
                    margins: margin ?? '5px 5px 5px 5px',
                    async: false,
                };
                if (url) body.url = url;
                if (html) body.html = html;
                const data = await pdfPost('/pdf/convert/from/html', body);
                return { output: { url: data.url, pageCount: data.pageCount, credits: data.credits } };
            }

            case 'urlToPdf': {
                const { url, name, printBackground } = inputs;
                if (!url) return { error: 'PDF.co urlToPdf: url is required.' };
                const data = await pdfPost('/pdf/convert/from/url', {
                    url,
                    name: name ?? 'result.pdf',
                    printBackground: printBackground ?? true,
                    async: false,
                });
                return { output: { url: data.url, pageCount: data.pageCount, credits: data.credits } };
            }

            case 'mergePdfs': {
                const { urls, name } = inputs;
                if (!urls || !Array.isArray(urls) || urls.length === 0) {
                    return { error: 'PDF.co mergePdfs: urls array is required.' };
                }
                const data = await pdfPost('/pdf/merge', {
                    url: urls.join(','),
                    name: name ?? 'merged.pdf',
                    async: false,
                });
                return { output: { url: data.url, credits: data.credits } };
            }

            case 'splitPdf': {
                const { url, pages, name } = inputs;
                if (!url) return { error: 'PDF.co splitPdf: url is required.' };
                const data = await pdfPost('/pdf/split', {
                    url,
                    pages: pages ?? '1,2-3',
                    name: name ?? undefined,
                    async: false,
                });
                return { output: { urls: data.urls ?? [], credits: data.credits } };
            }

            case 'addTextToPdf': {
                const { url, text, x, y, pages, fontSize, color } = inputs;
                if (!url) return { error: 'PDF.co addTextToPdf: url is required.' };
                if (text === undefined || text === null) return { error: 'PDF.co addTextToPdf: text is required.' };
                if (x === undefined) return { error: 'PDF.co addTextToPdf: x is required.' };
                if (y === undefined) return { error: 'PDF.co addTextToPdf: y is required.' };
                const data = await pdfPost('/pdf/edit/add', {
                    url,
                    annotations: [{
                        x,
                        y,
                        text: String(text),
                        fontSize: fontSize ?? 12,
                        color: color ?? '#FF0000',
                        pages: pages ?? '0',
                    }],
                    async: false,
                });
                return { output: { url: data.url, credits: data.credits } };
            }

            case 'fillPdfForm': {
                const { url, fields } = inputs;
                if (!url) return { error: 'PDF.co fillPdfForm: url is required.' };
                if (!fields) return { error: 'PDF.co fillPdfForm: fields is required.' };
                const data = await pdfPost('/pdf/edit/add', {
                    url,
                    fields,
                    async: false,
                });
                return { output: { url: data.url, credits: data.credits } };
            }

            case 'extractImages': {
                const { url, pages } = inputs;
                if (!url) return { error: 'PDF.co extractImages: url is required.' };
                const body: any = { url, async: false };
                if (pages) body.pages = pages;
                const data = await pdfPost('/pdf/convert/to/jpg', body);
                return { output: { urls: data.urls ?? [], credits: data.credits } };
            }

            case 'makeSearchable': {
                const { url } = inputs;
                if (!url) return { error: 'PDF.co makeSearchable: url is required.' };
                const data = await pdfPost('/pdf/make/searchable', { url, async: false });
                return { output: { url: data.url, credits: data.credits } };
            }

            case 'addWatermark': {
                const { url, text, imageUrl, x, y, opacity } = inputs;
                if (!url) return { error: 'PDF.co addWatermark: url is required.' };
                const annotation: any = {
                    x: x ?? 0,
                    y: y ?? 0,
                    fontSizePercent: 30,
                    opacity: opacity ?? 50,
                    pages: '0-',
                };
                if (text) annotation.text = String(text);
                if (imageUrl) annotation.url = imageUrl;
                const data = await pdfPost('/pdf/edit/add', {
                    url,
                    annotations: [annotation],
                    async: false,
                });
                return { output: { url: data.url, credits: data.credits } };
            }

            case 'protectPdf': {
                const { url, ownerPassword, userPassword, restrictions } = inputs;
                if (!url) return { error: 'PDF.co protectPdf: url is required.' };
                if (!ownerPassword) return { error: 'PDF.co protectPdf: ownerPassword is required.' };
                const body: any = {
                    url,
                    ownerPassword,
                    userPermissions: restrictions ?? ['printing', 'annotation'],
                    async: false,
                };
                if (userPassword) body.userPassword = userPassword;
                const data = await pdfPost('/security/sign/encrypt/pdf', body);
                return { output: { url: data.url, credits: data.credits } };
            }

            case 'getBalance': {
                const data = await pdfGet('/account/credit/balance');
                return {
                    output: {
                        credits: data.remainingCredits,
                        used: data.usedCredits,
                    },
                };
            }

            default:
                return { error: `PDF.co: unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`PDF.co action error: ${err?.message}`);
        return { error: err?.message ?? 'PDF.co action failed.' };
    }
}
