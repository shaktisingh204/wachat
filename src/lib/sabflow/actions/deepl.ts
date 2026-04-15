'use server';

function getDeepLBase(apiKey: string): string {
    return apiKey.endsWith(':fx')
        ? 'https://api-free.deepl.com/v2'
        : 'https://api.deepl.com/v2';
}

async function deeplGet(apiKey: string, path: string, logger: any) {
    const base = getDeepLBase(apiKey);
    logger.log(`[DeepL] GET ${path}`);
    const res = await fetch(`${base}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `DeepL API error: ${res.status}`);
    return data;
}

async function deeplPost(apiKey: string, path: string, body: any, logger: any) {
    const base = getDeepLBase(apiKey);
    logger.log(`[DeepL] POST ${path}`);
    const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `DeepL API error: ${res.status}`);
    return data;
}

async function deeplDelete(apiKey: string, path: string, logger: any) {
    const base = getDeepLBase(apiKey);
    logger.log(`[DeepL] DELETE ${path}`);
    const res = await fetch(`${base}${path}`, {
        method: 'DELETE',
        headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    });
    if (!res.ok) {
        let errMsg = `DeepL API error: ${res.status}`;
        try { const d = await res.json(); errMsg = d?.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
    }
    return { deleted: true };
}

export async function executeDeeplAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'translateText': {
                const text = String(inputs.text ?? '').trim();
                const targetLang = String(inputs.targetLang ?? '').trim();
                if (!text) throw new Error('text is required.');
                if (!targetLang) throw new Error('targetLang is required.');
                const body: any = { text: [text], target_lang: targetLang };
                if (inputs.sourceLang) body.source_lang = String(inputs.sourceLang).trim();
                if (inputs.formality) body.formality = String(inputs.formality).trim();
                if (inputs.glossaryId) body.glossary_id = String(inputs.glossaryId).trim();
                if (inputs.tagHandling) body.tag_handling = String(inputs.tagHandling).trim();
                logger.log(`[DeepL] translateText: targetLang=${targetLang}`);
                const data = await deeplPost(apiKey, '/translate', body, logger);
                return { output: { translations: data.translations ?? [] } };
            }

            case 'translateTexts': {
                const texts = Array.isArray(inputs.texts) ? inputs.texts : [String(inputs.texts ?? '')];
                const targetLang = String(inputs.targetLang ?? '').trim();
                if (!texts.length) throw new Error('texts is required.');
                if (!targetLang) throw new Error('targetLang is required.');
                const body: any = { text: texts, target_lang: targetLang };
                if (inputs.sourceLang) body.source_lang = String(inputs.sourceLang).trim();
                if (inputs.formality) body.formality = String(inputs.formality).trim();
                logger.log(`[DeepL] translateTexts: ${texts.length} texts, targetLang=${targetLang}`);
                const data = await deeplPost(apiKey, '/translate', body, logger);
                return { output: { translations: data.translations ?? [] } };
            }

            case 'translateDocument': {
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                const fileName = String(inputs.fileName ?? 'document').trim();
                const targetLang = String(inputs.targetLang ?? '').trim();
                if (!fileUrl) throw new Error('fileUrl is required.');
                if (!targetLang) throw new Error('targetLang is required.');
                logger.log(`[DeepL] translateDocument: downloading ${fileUrl}`);
                const fileRes = await fetch(fileUrl);
                if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`);
                const fileBuffer = await fileRes.arrayBuffer();
                const base = getDeepLBase(apiKey);
                const formData = new FormData();
                formData.append('file', new Blob([fileBuffer]), fileName);
                formData.append('target_lang', targetLang);
                if (inputs.sourceLang) formData.append('source_lang', String(inputs.sourceLang).trim());
                logger.log('[DeepL] translateDocument: uploading');
                const uploadRes = await fetch(`${base}/document`, {
                    method: 'POST',
                    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData?.message || `DeepL document upload error: ${uploadRes.status}`);
                return { output: { documentId: uploadData.document_id, documentKey: uploadData.document_key, status: 'queued' } };
            }

            case 'getDocumentStatus': {
                const documentId = String(inputs.documentId ?? '').trim();
                const documentKey = String(inputs.documentKey ?? '').trim();
                if (!documentId) throw new Error('documentId is required.');
                if (!documentKey) throw new Error('documentKey is required.');
                logger.log(`[DeepL] getDocumentStatus: ${documentId}`);
                const base = getDeepLBase(apiKey);
                const res = await fetch(`${base}/document/${documentId}`, {
                    method: 'POST',
                    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ document_key: documentKey }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `DeepL error: ${res.status}`);
                return { output: { status: data.status, secondsRemaining: data.seconds_remaining ?? null, billedCharacters: data.billed_characters ?? null } };
            }

            case 'downloadDocument': {
                const documentId = String(inputs.documentId ?? '').trim();
                const documentKey = String(inputs.documentKey ?? '').trim();
                if (!documentId) throw new Error('documentId is required.');
                if (!documentKey) throw new Error('documentKey is required.');
                logger.log(`[DeepL] downloadDocument: ${documentId}`);
                const base = getDeepLBase(apiKey);
                const res = await fetch(`${base}/document/${documentId}/result`, {
                    method: 'POST',
                    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ document_key: documentKey }),
                });
                if (!res.ok) throw new Error(`DeepL download error: ${res.status}`);
                const buffer = await res.arrayBuffer();
                const content = Buffer.from(buffer).toString('base64');
                return { output: { translatedContent: content } };
            }

            case 'getUsage': {
                logger.log('[DeepL] getUsage');
                const data = await deeplGet(apiKey, '/usage', logger);
                return { output: { character_count: data.character_count, character_limit: data.character_limit } };
            }

            case 'getLanguages': {
                const type = inputs.type ? String(inputs.type).trim() : 'target';
                logger.log(`[DeepL] getLanguages: type=${type}`);
                const data = await deeplGet(apiKey, `/languages?type=${type}`, logger);
                return { output: { languages: Array.isArray(data) ? data : [] } };
            }

            case 'getGlossaries': {
                logger.log('[DeepL] getGlossaries');
                const data = await deeplGet(apiKey, '/glossaries', logger);
                return { output: { glossaries: data.glossaries ?? [] } };
            }

            case 'createGlossary': {
                const name = String(inputs.name ?? '').trim();
                const sourceLang = String(inputs.sourceLang ?? '').trim();
                const targetLang = String(inputs.targetLang ?? '').trim();
                const entries = inputs.entries;
                if (!name) throw new Error('name is required.');
                if (!sourceLang) throw new Error('sourceLang is required.');
                if (!targetLang) throw new Error('targetLang is required.');
                if (!entries) throw new Error('entries is required.');
                const body: any = {
                    name,
                    source_lang: sourceLang,
                    target_lang: targetLang,
                    entries,
                    entries_format: inputs.entriesFormat ? String(inputs.entriesFormat).trim() : 'tsv',
                };
                logger.log(`[DeepL] createGlossary: name=${name}`);
                const data = await deeplPost(apiKey, '/glossaries', body, logger);
                return { output: { glossary_id: data.glossary_id, name: data.name, entry_count: data.entry_count } };
            }

            case 'getGlossary': {
                const glossaryId = String(inputs.glossaryId ?? '').trim();
                if (!glossaryId) throw new Error('glossaryId is required.');
                logger.log(`[DeepL] getGlossary: ${glossaryId}`);
                const data = await deeplGet(apiKey, `/glossaries/${glossaryId}`, logger);
                return { output: { glossary_id: data.glossary_id, name: data.name, entry_count: data.entry_count } };
            }

            case 'deleteGlossary': {
                const glossaryId = String(inputs.glossaryId ?? '').trim();
                if (!glossaryId) throw new Error('glossaryId is required.');
                logger.log(`[DeepL] deleteGlossary: ${glossaryId}`);
                const result = await deeplDelete(apiKey, `/glossaries/${glossaryId}`, logger);
                return { output: result };
            }

            case 'getGlossaryEntries': {
                const glossaryId = String(inputs.glossaryId ?? '').trim();
                if (!glossaryId) throw new Error('glossaryId is required.');
                logger.log(`[DeepL] getGlossaryEntries: ${glossaryId}`);
                const base = getDeepLBase(apiKey);
                const res = await fetch(`${base}/glossaries/${glossaryId}/entries`, {
                    headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, Accept: 'text/tab-separated-values' },
                });
                if (!res.ok) throw new Error(`DeepL API error: ${res.status}`);
                const tsvText = await res.text();
                const entries = tsvText
                    .split('\n')
                    .filter(line => line.trim().length > 0)
                    .map(line => {
                        const [source, target] = line.split('\t');
                        return { source: source?.trim() ?? '', target: target?.trim() ?? '' };
                    });
                return { output: { entries } };
            }

            case 'listGlossaryLanguagePairs': {
                logger.log('[DeepL] listGlossaryLanguagePairs');
                const data = await deeplGet(apiKey, '/glossary-language-pairs', logger);
                return { output: { supported_languages: data.supported_languages ?? [] } };
            }

            case 'getFormality': {
                const targetLang = String(inputs.targetLang ?? '').trim();
                if (!targetLang) throw new Error('targetLang is required.');
                logger.log(`[DeepL] getFormality: targetLang=${targetLang}`);
                const data = await deeplGet(apiKey, `/languages?type=target`, logger);
                const lang = (Array.isArray(data) ? data : []).find((l: any) => l.language?.toUpperCase() === targetLang.toUpperCase());
                return { output: { language: targetLang, supports_formality: lang?.supports_formality ?? false } };
            }

            case 'getSupportedLanguages': {
                const type = inputs.type ? String(inputs.type).trim() : 'source';
                logger.log(`[DeepL] getSupportedLanguages: type=${type}`);
                const data = await deeplGet(apiKey, `/languages?type=${type}`, logger);
                return { output: { languages: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Unknown DeepL action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[DeepL] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown error in DeepL action.' };
    }
}
