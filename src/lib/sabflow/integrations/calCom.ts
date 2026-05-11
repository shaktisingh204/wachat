import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeCalCom(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  if (!apiKey) return { error: 'cal_com: apiKey credential is required' };

  const operation = (options.operation as string) ?? 'getBookings';
  const base = 'https://api.cal.com/v2';
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    if (operation === 'getBookings') {
      const res = await fetch(`${base}/bookings`, { headers });
      if (!res.ok) throw new Error(`Cal.com ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { data?: unknown[] };
      return {
        outputs: {
          bookings: JSON.stringify(data.data ?? []),
          count: String(data.data?.length ?? 0),
        },
      };
    }
    if (operation === 'cancelBooking') {
      const bookingId = options.bookingId as string;
      if (!bookingId) return { error: 'cal_com cancelBooking: bookingId is required' };
      const res = await fetch(`${base}/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: (options.reason as string) ?? '' }),
      });
      if (!res.ok) throw new Error(`Cal.com ${res.status}: ${await res.text()}`);
      return { outputs: { cancelled: 'true' } };
    }
    return { error: `cal_com: unknown operation "${operation}"` };
  } catch (err) {
    return { error: `cal_com failed: ${(err as Error).message}` };
  }
}
