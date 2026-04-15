
'use server';

const ASSEMBLYAI_BASE = 'https://api.assemblyai.com/v2';
const LEMUR_BASE = 'https://api.assemblyai.com/lemur/v3';

async function aaiGet(apiKey: string, path: string, logger: any) {
    logger.log(`[AssemblyAI] GET ${path}`);
    const res = await fetch(`${ASSEMBLYAI_BASE}${path}`, {
        method: 'GET',
        headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `AssemblyAI API error: ${res.status}`);
    }
    return res;
}

async function aaiGetJson(apiKey: string, path: string, logger: any) {
    const res = await aaiGet(apiKey, path, logger);
    return res.json();
}

async function aaiPost(apiKey: string, path: string, body: any, logger: any, baseUrl = ASSEMBLYAI_BASE) {
    logger.log(`[AssemblyAI] POST ${path}`);
    const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || `AssemblyAI API error: ${res.status}`);
    }
    return data;
}

async function aaiDelete(apiKey: string, path: string, logger: any) {
    logger.log(`[AssemblyAI] DELETE ${path}`);
    const res = await fetch(`${ASSEMBLYAI_BASE}${path}`, {
        method: 'DELETE',
        headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error || `AssemblyAI API error: ${res.status}`);
    }
    return data;
}

async function pollTranscript(apiKey: string, transcriptId: string, maxWaitSeconds: number, logger: any) {
    const maxAttempts = Math.ceil(maxWaitSeconds / 3);
    let attempts = 0;
    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 3000));
        const data = await aaiGetJson(apiKey, `/transcript/${transcriptId}`, logger);
        if (data.status === 'completed' || data.status === 'error') {
            return data;
        }
        attempts++;
        logger.log(`[AssemblyAI] Polling transcript ${transcriptId}: status=${data.status} (attempt ${attempts}/${maxAttempts})`);
    }
    throw new Error(`Transcript polling timed out after ${maxWaitSeconds}s.`);
}

export async function executeAssemblyAIAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'transcribeUrl': {
                const audioUrl = String(inputs.audioUrl ?? '').trim();
                if (!audioUrl) throw new Error('audioUrl is required.');

                const body: any = {
                    audio_url: audioUrl,
                    punctuate: inputs.punctuate !== undefined ? Boolean(inputs.punctuate) : true,
                    format_text: inputs.formatText !== undefined ? Boolean(inputs.formatText) : true,
                    disfluencies: inputs.disfluencies !== undefined ? Boolean(inputs.disfluencies) : false,
                };
                if (inputs.languageCode) body.language_code = String(inputs.languageCode).trim();
                if (inputs.speakerLabels !== undefined) body.speaker_labels = Boolean(inputs.speakerLabels);

                logger.log(`[AssemblyAI] transcribeUrl: ${audioUrl}`);
                const data = await aaiPost(apiKey, '/transcript', body, logger);
                return { output: { id: data.id, status: data.status } };
            }

            case 'getTranscript': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');

                logger.log(`[AssemblyAI] getTranscript: ${transcriptId}`);
                const data = await aaiGetJson(apiKey, `/transcript/${transcriptId}`, logger);
                return {
                    output: {
                        id: data.id,
                        status: data.status,
                        text: data.text ?? '',
                        words: data.words ?? [],
                        confidence: data.confidence,
                        audio_duration: data.audio_duration,
                    },
                };
            }

            case 'waitForTranscript': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');
                const maxWait = inputs.maxWaitSeconds !== undefined ? Number(inputs.maxWaitSeconds) : 300;

                logger.log(`[AssemblyAI] waitForTranscript: ${transcriptId}, maxWait=${maxWait}s`);
                const data = await pollTranscript(apiKey, transcriptId, maxWait, logger);
                if (data.status === 'error') throw new Error(data.error || 'Transcription failed.');
                return {
                    output: {
                        id: data.id,
                        status: data.status,
                        text: data.text ?? '',
                        words: data.words ?? [],
                        utterances: data.utterances ?? [],
                    },
                };
            }

            case 'transcribeAndWait': {
                const audioUrl = String(inputs.audioUrl ?? '').trim();
                if (!audioUrl) throw new Error('audioUrl is required.');

                const body: any = {
                    audio_url: audioUrl,
                    punctuate: true,
                    format_text: true,
                };
                if (inputs.languageCode) body.language_code = String(inputs.languageCode).trim();
                if (inputs.speakerLabels !== undefined) body.speaker_labels = Boolean(inputs.speakerLabels);
                if (inputs.sentimentAnalysis !== undefined) body.sentiment_analysis = Boolean(inputs.sentimentAnalysis);
                if (inputs.autoChapters !== undefined) body.auto_chapters = Boolean(inputs.autoChapters);

                logger.log(`[AssemblyAI] transcribeAndWait: submitting ${audioUrl}`);
                const submitted = await aaiPost(apiKey, '/transcript', body, logger);
                logger.log(`[AssemblyAI] transcribeAndWait: polling transcriptId=${submitted.id}`);
                const data = await pollTranscript(apiKey, submitted.id, 600, logger);
                if (data.status === 'error') throw new Error(data.error || 'Transcription failed.');
                return {
                    output: {
                        id: data.id,
                        text: data.text ?? '',
                        words: data.words ?? [],
                        utterances: data.utterances ?? [],
                        sentimentAnalysisResults: data.sentiment_analysis_results ?? [],
                        chapters: data.chapters ?? [],
                    },
                };
            }

            case 'listTranscripts': {
                const limit = inputs.limit !== undefined ? Number(inputs.limit) : 25;
                let path = `/transcript?limit=${limit}`;
                if (inputs.status) path += `&status=${String(inputs.status).trim()}`;

                logger.log(`[AssemblyAI] listTranscripts: limit=${limit}`);
                const data = await aaiGetJson(apiKey, path, logger);
                return {
                    output: {
                        transcripts: data.transcripts ?? [],
                        page_details: data.page_details ?? {},
                    },
                };
            }

            case 'deleteTranscript': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');

                logger.log(`[AssemblyAI] deleteTranscript: ${transcriptId}`);
                const data = await aaiDelete(apiKey, `/transcript/${transcriptId}`, logger);
                return { output: { id: data.id, status: 'deleted' } };
            }

            case 'getSubtitles': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');
                const format = inputs.format ? String(inputs.format).trim() : 'srt';
                const charsPerCaption = inputs.charsPerCaption !== undefined ? Number(inputs.charsPerCaption) : 32;

                logger.log(`[AssemblyAI] getSubtitles: ${transcriptId}, format=${format}`);
                const res = await aaiGet(apiKey, `/transcript/${transcriptId}/${format}?chars_per_caption=${charsPerCaption}`, logger);
                const subtitles = await res.text();
                return { output: { subtitles, format } };
            }

            case 'getSentences': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');

                logger.log(`[AssemblyAI] getSentences: ${transcriptId}`);
                const data = await aaiGetJson(apiKey, `/transcript/${transcriptId}/sentences`, logger);
                return { output: { sentences: data.sentences ?? [] } };
            }

            case 'getParagraphs': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');

                logger.log(`[AssemblyAI] getParagraphs: ${transcriptId}`);
                const data = await aaiGetJson(apiKey, `/transcript/${transcriptId}/paragraphs`, logger);
                return { output: { paragraphs: data.paragraphs ?? [] } };
            }

            case 'searchWords': {
                const transcriptId = String(inputs.transcriptId ?? '').trim();
                if (!transcriptId) throw new Error('transcriptId is required.');
                const words = Array.isArray(inputs.words) ? inputs.words : String(inputs.words ?? '').split(',');
                if (!words.length) throw new Error('words is required.');

                const wordsParam = words.map((w: string) => encodeURIComponent(w.trim())).join(',');
                logger.log(`[AssemblyAI] searchWords: ${transcriptId}`);
                const data = await aaiGetJson(apiKey, `/transcript/${transcriptId}/word-search?words=${wordsParam}`, logger);
                return { output: { id: data.id, matches: data.matches ?? [] } };
            }

            case 'applyLeMUR': {
                const transcriptIds = Array.isArray(inputs.transcriptIds) ? inputs.transcriptIds : [String(inputs.transcriptIds ?? '')];
                const prompt = String(inputs.prompt ?? '').trim();
                if (!transcriptIds.length) throw new Error('transcriptIds is required.');
                if (!prompt) throw new Error('prompt is required.');

                const body: any = {
                    transcript_ids: transcriptIds,
                    prompt,
                    final_model: inputs.finalModel ? String(inputs.finalModel).trim() : 'anthropic/claude-3-5-sonnet',
                    max_output_size: inputs.maxOutputSize !== undefined ? Number(inputs.maxOutputSize) : 3000,
                };

                logger.log(`[AssemblyAI] applyLeMUR: ${transcriptIds.length} transcript(s)`);
                const data = await aaiPost(apiKey, '/generate/task', body, logger, LEMUR_BASE);
                return { output: { request_id: data.request_id, response: data.response } };
            }

            case 'summarize': {
                const transcriptIds = Array.isArray(inputs.transcriptIds) ? inputs.transcriptIds : [String(inputs.transcriptIds ?? '')];
                if (!transcriptIds.length) throw new Error('transcriptIds is required.');

                const body: any = {
                    transcript_ids: transcriptIds,
                    answer_format: inputs.answerFormat ? String(inputs.answerFormat).trim() : 'bullets',
                };
                if (inputs.context) body.context = String(inputs.context).trim();

                logger.log(`[AssemblyAI] summarize: ${transcriptIds.length} transcript(s)`);
                const data = await aaiPost(apiKey, '/generate/summary', body, logger, LEMUR_BASE);
                return { output: { request_id: data.request_id, response: data.response } };
            }

            default:
                return { error: `Unknown AssemblyAI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`[AssemblyAI] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown error in AssemblyAI action.' };
    }
}
