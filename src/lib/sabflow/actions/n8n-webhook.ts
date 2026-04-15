'use server';

export async function executeN8nWebhookAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const webhookUrl = inputs.webhookUrl as string;
  if (!webhookUrl) return { error: 'Missing webhookUrl' };

  const method = ((inputs.method as string) || 'POST').toUpperCase();
  const authType = (inputs.authType as string) || 'none';

  function buildAuthHeader(): Record<string, string> {
    if (authType === 'bearer' && inputs.bearerToken) {
      return { Authorization: `Bearer ${inputs.bearerToken}` };
    }
    if (authType === 'basic' && inputs.username && inputs.password) {
      const creds = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
      return { Authorization: `Basic ${creds}` };
    }
    return {};
  }

  function buildCustomHeaders(): Record<string, string> {
    if (!inputs.headers) return {};
    if (typeof inputs.headers === 'string') {
      try {
        return JSON.parse(inputs.headers) as Record<string, string>;
      } catch {
        return {};
      }
    }
    if (typeof inputs.headers === 'object' && inputs.headers !== null) {
      return inputs.headers as Record<string, string>;
    }
    return {};
  }

  function buildBody(data?: unknown): string | undefined {
    const payload = data ?? inputs.body;
    if (payload === undefined || payload === null || payload === '') return undefined;
    if (typeof payload === 'string') {
      // Already a JSON string or raw string
      return payload;
    }
    return JSON.stringify(payload);
  }

  async function makeRequest(
    reqMethod: string,
    url: string,
    body?: string | undefined
  ): Promise<{ output?: Record<string, unknown>; error?: string }> {
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...buildAuthHeader(),
      ...buildCustomHeaders(),
    };

    const fetchOptions: RequestInit = {
      method: reqMethod,
      headers: requestHeaders,
    };

    if (body && reqMethod !== 'GET' && reqMethod !== 'HEAD') {
      fetchOptions.body = body;
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    if (!res.ok) {
      return { error: `Webhook call failed ${res.status}: ${text}` };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return {
      output: {
        status: res.status,
        statusText: res.statusText,
        data: parsed,
      },
    };
  }

  switch (action) {
    case 'trigger': {
      const body = buildBody();
      return makeRequest(method, webhookUrl, body);
    }

    case 'testWebhook': {
      return makeRequest('GET', webhookUrl, undefined);
    }

    case 'sendData': {
      let data: unknown = inputs.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // keep as string
        }
      }
      const body = buildBody(data);
      return makeRequest('POST', webhookUrl, body);
    }

    case 'callWithRetry': {
      let data: unknown = inputs.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // keep as string
        }
      }
      const body = buildBody(data);
      const maxRetries = (inputs.maxRetries as number) || 3;
      const delayMs = (inputs.delayMs as number) || 1000;

      let lastError = '';
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const backoff = delayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }

        const result = await makeRequest(method, webhookUrl, body);
        if (result.output) {
          return {
            output: {
              ...result.output,
              attempts: attempt + 1,
            },
          };
        }
        lastError = result.error || 'Unknown error';
      }

      return { error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError}` };
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}
