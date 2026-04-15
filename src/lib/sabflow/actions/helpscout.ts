'use server';

const HELPSCOUT_BASE = 'https://api.helpscout.net/v2';

async function getHelpscoutToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch('https://api.helpscout.net/v2/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HelpScout token error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function executeHelpscoutAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const clientId = inputs.clientId as string;
  const clientSecret = inputs.clientSecret as string;
  if (!clientId) return { error: 'Missing clientId' };
  if (!clientSecret) return { error: 'Missing clientSecret' };

  let token: string;
  try {
    token = await getHelpscoutToken(clientId, clientSecret);
  } catch (err) {
    return { error: (err as Error).message };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function hsFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<{ output?: Record<string, unknown>; error?: string }> {
    const url = `${HELPSCOUT_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });
    if (res.status === 204) return { output: { success: true } };
    const text = await res.text();
    if (!res.ok) return { error: `HelpScout API error ${res.status}: ${text}` };
    if (!text) return { output: { success: true } };
    try {
      return { output: JSON.parse(text) };
    } catch {
      return { output: { raw: text } };
    }
  }

  switch (action) {
    case 'listConversations': {
      const params = new URLSearchParams();
      if (inputs.mailboxId) params.set('mailbox', inputs.mailboxId as string);
      if (inputs.status) params.set('status', inputs.status as string);
      if (inputs.query) params.set('query', inputs.query as string);
      params.set('page', String((inputs.page as number) || 1));
      return hsFetch(`/conversations?${params.toString()}`);
    }

    case 'getConversation': {
      const conversationId = inputs.conversationId as string;
      if (!conversationId) return { error: 'Missing conversationId' };
      return hsFetch(`/conversations/${conversationId}`);
    }

    case 'createConversation': {
      const mailboxId = inputs.mailboxId as string;
      const customerEmail = inputs.customerEmail as string;
      if (!mailboxId || !customerEmail) return { error: 'Missing mailboxId or customerEmail' };
      const body: Record<string, unknown> = {
        type: (inputs.type as string) || 'email',
        mailbox: { id: Number(mailboxId) },
        subject: inputs.subject,
        customer: { email: customerEmail },
        threads: [
          {
            type: 'customer',
            customer: { email: customerEmail },
            body: inputs.body,
          },
        ],
      };
      if (inputs.tags) {
        let tags: string[];
        if (Array.isArray(inputs.tags)) {
          tags = inputs.tags as string[];
        } else if (typeof inputs.tags === 'string') {
          try {
            tags = JSON.parse(inputs.tags);
          } catch {
            tags = (inputs.tags as string).split(',').map((t) => t.trim());
          }
        } else {
          tags = [];
        }
        body.tags = tags;
      }
      return hsFetch('/conversations', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'updateConversation': {
      const conversationId = inputs.conversationId as string;
      if (!conversationId) return { error: 'Missing conversationId' };
      const body: Record<string, unknown> = {};
      if (inputs.status) body.status = inputs.status;
      if (inputs.assignToUser) body.assignTo = inputs.assignToUser;
      return hsFetch(`/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    }

    case 'deleteConversation': {
      const conversationId = inputs.conversationId as string;
      if (!conversationId) return { error: 'Missing conversationId' };
      return hsFetch(`/conversations/${conversationId}`, { method: 'DELETE' });
    }

    case 'replyToConversation': {
      const conversationId = inputs.conversationId as string;
      if (!conversationId) return { error: 'Missing conversationId' };
      const thread: Record<string, unknown> = {
        type: 'reply',
        body: inputs.body,
      };
      if (inputs.cc) thread.cc = inputs.cc;
      if (inputs.bcc) thread.bcc = inputs.bcc;
      return hsFetch(`/conversations/${conversationId}/threads`, {
        method: 'POST',
        body: JSON.stringify(thread),
      });
    }

    case 'addNote': {
      const conversationId = inputs.conversationId as string;
      if (!conversationId) return { error: 'Missing conversationId' };
      return hsFetch(`/conversations/${conversationId}/threads`, {
        method: 'POST',
        body: JSON.stringify({ type: 'note', body: inputs.body }),
      });
    }

    case 'listCustomers': {
      const params = new URLSearchParams();
      params.set('page', String((inputs.page as number) || 1));
      if (inputs.query) params.set('query', inputs.query as string);
      return hsFetch(`/customers?${params.toString()}`);
    }

    case 'getCustomer': {
      const customerId = inputs.customerId as string;
      if (!customerId) return { error: 'Missing customerId' };
      return hsFetch(`/customers/${customerId}`);
    }

    case 'createCustomer': {
      const customer: Record<string, unknown> = {
        emails: [{ value: inputs.email, type: 'work' }],
      };
      if (inputs.firstName) customer.firstName = inputs.firstName;
      if (inputs.lastName) customer.lastName = inputs.lastName;
      if (inputs.phone) {
        customer.phones = [{ value: inputs.phone, type: 'work' }];
      }
      return hsFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(customer),
      });
    }

    case 'listMailboxes':
      return hsFetch('/mailboxes');

    case 'listUsers':
      return hsFetch('/users');

    default:
      return { error: `Unknown action: ${action}` };
  }
}
