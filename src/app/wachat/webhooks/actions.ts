'use server';

export async function pingWebhookUrl(url: string, secret: string) {
  try {
    const payload = JSON.stringify({ event: 'ping', token: 'sabnode_verify_token' });
    
    // We can also sign it if needed, but for a ping, just passing it in the header/body
    // Usually webhooks expect a signature. Let's add a dummy one or compute a real HMAC
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SabNode-Webhook-Validator',
    };

    if (secret) {
      // In node, we can compute HMAC
      const crypto = require('crypto');
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      headers['X-Hub-Signature-256'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: `Received status ${res.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Unknown error' };
  }
}
