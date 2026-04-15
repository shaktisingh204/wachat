'use server';

export async function executeAssemblyAIEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.assemblyai.com';
    const apiKey = inputs.apiKey;

    if (!apiKey) {
        return { error: 'Missing required credential: inputs.apiKey' };
    }

    const headers: Record<string, string> = {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createTranscript': {
                const body: any = {
                    audio_url: inputs.audioUrl,
                };
                if (inputs.languageCode) body.language_code = inputs.languageCode;
                if (inputs.punctuate !== undefined) body.punctuate = inputs.punctuate;
                if (inputs.formatText !== undefined) body.format_text = inputs.formatText;
                if (inputs.dualChannel !== undefined) body.dual_channel = inputs.dualChannel;
                if (inputs.webhookUrl) body.webhook_url = inputs.webhookUrl;
                if (inputs.audioStartFrom) body.audio_start_from = inputs.audioStartFrom;
                if (inputs.audioEndAt) body.audio_end_at = inputs.audioEndAt;
                if (inputs.wordBoost) body.word_boost = inputs.wordBoost;
                if (inputs.boostParam) body.boost_param = inputs.boostParam;
                if (inputs.filterProfanity !== undefined) body.filter_profanity = inputs.filterProfanity;
                if (inputs.redactPii !== undefined) body.redact_pii = inputs.redactPii;
                if (inputs.speakerLabels !== undefined) body.speaker_labels = inputs.speakerLabels;
                if (inputs.sentimentAnalysis !== undefined) body.sentiment_analysis = inputs.sentimentAnalysis;
                if (inputs.autoHighlights !== undefined) body.auto_highlights = inputs.autoHighlights;
                const res = await fetch(`${BASE_URL}/v2/transcript`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI createTranscript failed' };
                return { output: data };
            }

            case 'getTranscript': {
                const transcriptId = inputs.transcriptId;
                if (!transcriptId) return { error: 'Missing inputs.transcriptId' };
                const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getTranscript failed' };
                return { output: data };
            }

            case 'deleteTranscript': {
                const transcriptId = inputs.transcriptId;
                if (!transcriptId) return { error: 'Missing inputs.transcriptId' };
                const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI deleteTranscript failed' };
                return { output: data };
            }

            case 'listTranscripts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.createdOn) params.set('created_on', inputs.createdOn);
                if (inputs.beforeId) params.set('before_id', inputs.beforeId);
                if (inputs.afterId) params.set('after_id', inputs.afterId);
                const url = `${BASE_URL}/v2/transcript${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI listTranscripts failed' };
                return { output: data };
            }

            case 'getSubtitles': {
                const transcriptId = inputs.transcriptId;
                const subtitleFormat = inputs.subtitleFormat || 'srt';
                if (!transcriptId) return { error: 'Missing inputs.transcriptId' };
                const params = new URLSearchParams();
                if (inputs.charsPerCaption) params.set('chars_per_caption', String(inputs.charsPerCaption));
                const url = `${BASE_URL}/v2/transcript/${transcriptId}/${subtitleFormat}${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { method: 'GET', headers: { 'Authorization': apiKey } });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error || 'AssemblyAI getSubtitles failed' };
                }
                const text = await res.text();
                return { output: { subtitles: text, format: subtitleFormat } };
            }

            case 'getParagraphs': {
                const transcriptId = inputs.transcriptId;
                if (!transcriptId) return { error: 'Missing inputs.transcriptId' };
                const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}/paragraphs`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getParagraphs failed' };
                return { output: data };
            }

            case 'getSentences': {
                const transcriptId = inputs.transcriptId;
                if (!transcriptId) return { error: 'Missing inputs.transcriptId' };
                const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}/sentences`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getSentences failed' };
                return { output: data };
            }

            case 'getWordSearch': {
                const transcriptId = inputs.transcriptId;
                if (!transcriptId) return { error: 'Missing inputs.transcriptId' };
                if (!inputs.words) return { error: 'Missing inputs.words' };
                const params = new URLSearchParams();
                const words = Array.isArray(inputs.words) ? inputs.words.join(',') : inputs.words;
                params.set('words', words);
                const res = await fetch(`${BASE_URL}/v2/transcript/${transcriptId}/word-search?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getWordSearch failed' };
                return { output: data };
            }

            case 'getLemurTask': {
                const body: any = {
                    transcript_ids: inputs.transcriptIds || [],
                    prompt: inputs.prompt || '',
                };
                if (inputs.context) body.context = inputs.context;
                if (inputs.finalModel) body.final_model = inputs.finalModel;
                if (inputs.maxOutputSize) body.max_output_size = inputs.maxOutputSize;
                const res = await fetch(`${BASE_URL}/lemur/v3/generate/task`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getLemurTask failed' };
                return { output: data };
            }

            case 'getLemurSummary': {
                const body: any = {
                    transcript_ids: inputs.transcriptIds || [],
                };
                if (inputs.context) body.context = inputs.context;
                if (inputs.answerFormat) body.answer_format = inputs.answerFormat;
                if (inputs.finalModel) body.final_model = inputs.finalModel;
                if (inputs.maxOutputSize) body.max_output_size = inputs.maxOutputSize;
                const res = await fetch(`${BASE_URL}/lemur/v3/generate/summary`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getLemurSummary failed' };
                return { output: data };
            }

            case 'getLemurQA': {
                const body: any = {
                    transcript_ids: inputs.transcriptIds || [],
                    questions: inputs.questions || [],
                };
                if (inputs.context) body.context = inputs.context;
                if (inputs.finalModel) body.final_model = inputs.finalModel;
                if (inputs.maxOutputSize) body.max_output_size = inputs.maxOutputSize;
                const res = await fetch(`${BASE_URL}/lemur/v3/generate/question-answer`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getLemurQA failed' };
                return { output: data };
            }

            case 'getLemurActionItems': {
                const body: any = {
                    transcript_ids: inputs.transcriptIds || [],
                };
                if (inputs.context) body.context = inputs.context;
                if (inputs.answerFormat) body.answer_format = inputs.answerFormat;
                if (inputs.finalModel) body.final_model = inputs.finalModel;
                if (inputs.maxOutputSize) body.max_output_size = inputs.maxOutputSize;
                const res = await fetch(`${BASE_URL}/lemur/v3/generate/action-items`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getLemurActionItems failed' };
                return { output: data };
            }

            case 'getLemurResponse': {
                const requestId = inputs.requestId;
                if (!requestId) return { error: 'Missing inputs.requestId' };
                const res = await fetch(`${BASE_URL}/lemur/v3/${requestId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getLemurResponse failed' };
                return { output: data };
            }

            case 'getRealtimeToken': {
                const body: any = {
                    expires_in: inputs.expiresIn || 480,
                };
                const res = await fetch(`${BASE_URL}/v2/realtime/token`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI getRealtimeToken failed' };
                return { output: data };
            }

            case 'listRealtimeSessions': {
                const res = await fetch(`${BASE_URL}/v2/realtime/sessions`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error || 'AssemblyAI listRealtimeSessions failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown AssemblyAI Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`AssemblyAIEnhanced error [${actionName}]: ${err.message}`);
        return { error: err.message || 'AssemblyAI Enhanced action failed' };
    }
}
