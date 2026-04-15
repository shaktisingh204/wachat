'use server';

export async function executeOpenAiAssistantsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey, assistantId, threadId, runId, model, name, instructions, tools, message, sessionId } = inputs;

        const baseUrl = 'https://api.openai.com/v1';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'assistants=v2',
        };

        switch (actionName) {
            case 'listAssistants': {
                const res = await fetch(`${baseUrl}/assistants`, { method: 'GET', headers });
                if (!res.ok) return { error: `OpenAI listAssistants failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getAssistant': {
                const res = await fetch(`${baseUrl}/assistants/${assistantId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `OpenAI getAssistant failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createAssistant': {
                const body: any = { model };
                if (name) body.name = name;
                if (instructions) body.instructions = instructions;
                if (tools) body.tools = tools;
                const res = await fetch(`${baseUrl}/assistants`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `OpenAI createAssistant failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'updateAssistant': {
                const body: any = {};
                if (model) body.model = model;
                if (name) body.name = name;
                if (instructions) body.instructions = instructions;
                if (tools) body.tools = tools;
                const res = await fetch(`${baseUrl}/assistants/${assistantId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `OpenAI updateAssistant failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteAssistant': {
                const res = await fetch(`${baseUrl}/assistants/${assistantId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `OpenAI deleteAssistant failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'createThread': {
                const res = await fetch(`${baseUrl}/threads`, { method: 'POST', headers, body: JSON.stringify({}) });
                if (!res.ok) return { error: `OpenAI createThread failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getThread': {
                const res = await fetch(`${baseUrl}/threads/${threadId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `OpenAI getThread failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'deleteThread': {
                const res = await fetch(`${baseUrl}/threads/${threadId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `OpenAI deleteThread failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'addMessage': {
                const body = { role: 'user', content: message };
                const res = await fetch(`${baseUrl}/threads/${threadId}/messages`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `OpenAI addMessage failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'listMessages': {
                const res = await fetch(`${baseUrl}/threads/${threadId}/messages`, { method: 'GET', headers });
                if (!res.ok) return { error: `OpenAI listMessages failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'runThread': {
                const body: any = { assistant_id: assistantId };
                if (inputs.runInstructions) body.instructions = inputs.runInstructions;
                const res = await fetch(`${baseUrl}/threads/${threadId}/runs`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `OpenAI runThread failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'getRun': {
                const res = await fetch(`${baseUrl}/threads/${threadId}/runs/${runId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `OpenAI getRun failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'waitForRun': {
                const terminalStatuses = ['completed', 'failed', 'requires_action', 'cancelled', 'expired'];
                const maxAttempts = 60;
                let attempts = 0;
                let runData: any = null;
                while (attempts < maxAttempts) {
                    const res = await fetch(`${baseUrl}/threads/${threadId}/runs/${runId}`, { method: 'GET', headers });
                    if (!res.ok) return { error: `OpenAI waitForRun poll failed: ${res.status} ${await res.text()}` };
                    runData = await res.json();
                    if (terminalStatuses.includes(runData.status)) break;
                    await new Promise(r => setTimeout(r, 2000));
                    attempts++;
                }
                return { output: runData };
            }
            case 'cancelRun': {
                const res = await fetch(`${baseUrl}/threads/${threadId}/runs/${runId}/cancel`, { method: 'POST', headers, body: JSON.stringify({}) });
                if (!res.ok) return { error: `OpenAI cancelRun failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            case 'submitToolOutputs': {
                const body = { tool_outputs: inputs.toolOutputs };
                const res = await fetch(`${baseUrl}/threads/${threadId}/runs/${runId}/submit_tool_outputs`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `OpenAI submitToolOutputs failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `OpenAI Assistants: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'OpenAI Assistants action failed' };
    }
}
