'use client';

/**
 * Shared in-memory API call log for the /wachat/calls/settings page.
 *
 * Both the page (project reloads) and the <CallingSettingsForm> component
 * (Meta fetches + saves) push entries here. The log lives at module scope
 * so it survives tab switches inside the page but resets on hard reload.
 */

export type ApiLogEntry = {
  id: string;
  method: 'GET' | 'POST';
  status: 'SUCCESS' | 'ERROR';
  summary: string;
  errorMessage?: string;
  createdAt: Date;
};

let apiLog: ApiLogEntry[] = [];
const listeners: Array<(log: ApiLogEntry[]) => void> = [];

export function recordApiCall(entry: Omit<ApiLogEntry, 'id' | 'createdAt'>) {
  const full: ApiLogEntry = {
    ...entry,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : String(Date.now() + Math.random()),
    createdAt: new Date(),
  };
  apiLog = [full, ...apiLog].slice(0, 50);
  listeners.forEach((l) => l(apiLog));
}

export function clearApiLog() {
  apiLog = [];
  listeners.forEach((l) => l(apiLog));
}

export function subscribeApiLog(fn: (log: ApiLogEntry[]) => void) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function getApiLog(): ApiLogEntry[] {
  return apiLog;
}
