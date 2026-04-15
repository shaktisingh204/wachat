'use server';

const CALENDLY_BASE = 'https://api.calendly.com';

export async function executeCalendlyAction(
  action: string,
  inputs: Record<string, unknown>
): Promise<{ output?: Record<string, unknown>; error?: string }> {
  const token = inputs.token as string;
  if (!token) return { error: 'Missing token' };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function calendlyFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<{ output?: Record<string, unknown>; error?: string }> {
    const url = path.startsWith('http') ? path : `${CALENDLY_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
    });
    if (res.status === 204) return { output: { success: true } };
    const text = await res.text();
    if (!res.ok) return { error: `Calendly API error ${res.status}: ${text}` };
    try {
      return { output: JSON.parse(text) };
    } catch {
      return { output: { raw: text } };
    }
  }

  switch (action) {
    case 'getCurrentUser':
      return calendlyFetch('/users/me');

    case 'listEventTypes': {
      const params = new URLSearchParams();
      if (inputs.userUri) params.set('user', inputs.userUri as string);
      if (inputs.organization) params.set('organization', inputs.organization as string);
      return calendlyFetch(`/event_types?${params.toString()}`);
    }

    case 'getEventType': {
      const uuid = inputs.uuid as string;
      if (!uuid) return { error: 'Missing uuid' };
      return calendlyFetch(`/event_types/${uuid}`);
    }

    case 'listEvents': {
      const params = new URLSearchParams();
      if (inputs.organization) params.set('organization', inputs.organization as string);
      if (inputs.user) params.set('user', inputs.user as string);
      params.set('count', String((inputs.count as number) || 20));
      if (inputs.status) params.set('status', inputs.status as string);
      return calendlyFetch(`/scheduled_events?${params.toString()}`);
    }

    case 'getEvent': {
      const uuid = inputs.uuid as string;
      if (!uuid) return { error: 'Missing uuid' };
      return calendlyFetch(`/scheduled_events/${uuid}`);
    }

    case 'cancelEvent': {
      const uuid = inputs.uuid as string;
      if (!uuid) return { error: 'Missing uuid' };
      const body: Record<string, unknown> = {};
      if (inputs.reason) body.reason = inputs.reason;
      return calendlyFetch(`/scheduled_events/${uuid}/cancellation`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'listInvitees': {
      const eventUuid = inputs.eventUuid as string;
      if (!eventUuid) return { error: 'Missing eventUuid' };
      const count = (inputs.count as number) || 20;
      return calendlyFetch(`/scheduled_events/${eventUuid}/invitees?count=${count}`);
    }

    case 'getInvitee': {
      const eventUuid = inputs.eventUuid as string;
      const inviteeUuid = inputs.inviteeUuid as string;
      if (!eventUuid || !inviteeUuid) return { error: 'Missing eventUuid or inviteeUuid' };
      return calendlyFetch(`/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`);
    }

    case 'listOrganizationMemberships': {
      const organization = inputs.organization as string;
      if (!organization) return { error: 'Missing organization' };
      return calendlyFetch(`/organization_memberships?organization=${encodeURIComponent(organization)}`);
    }

    case 'createWebhook': {
      const url = inputs.url as string;
      const organization = inputs.organization as string;
      if (!url || !organization) return { error: 'Missing url or organization' };
      let events: string[];
      if (Array.isArray(inputs.events)) {
        events = inputs.events as string[];
      } else if (typeof inputs.events === 'string') {
        try {
          events = JSON.parse(inputs.events);
        } catch {
          events = [inputs.events];
        }
      } else {
        return { error: 'Missing events' };
      }
      const body: Record<string, unknown> = {
        url,
        events,
        organization,
        scope: 'organization',
      };
      if (inputs.user) body.user = inputs.user;
      return calendlyFetch('/webhook_subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    case 'listWebhooks': {
      const organization = inputs.organization as string;
      if (!organization) return { error: 'Missing organization' };
      return calendlyFetch(
        `/webhook_subscriptions?organization=${encodeURIComponent(organization)}&scope=organization`
      );
    }

    case 'deleteWebhook': {
      const uuid = inputs.uuid as string;
      if (!uuid) return { error: 'Missing uuid' };
      return calendlyFetch(`/webhook_subscriptions/${uuid}`, { method: 'DELETE' });
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}
