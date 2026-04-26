'use server';

/**
 * Compatibility shim — `wabasimplify/connections/app-connection-setup.tsx`
 * and `wabasimplify/new-connection-dialog.tsx` import
 * `saveSabFlowConnection` from this path. The action was never wired up;
 * we expose a no-op so the build compiles. Replace with the real
 * persistence call once the connection flow is reactivated.
 */
export type SabFlowConnectionState = {
  ok?: boolean;
  id?: string;
  message?: string | null;
  error?: string | null;
};

export async function saveSabFlowConnection(
  _previousState: SabFlowConnectionState,
  _formData: FormData,
): Promise<SabFlowConnectionState> {
  return { ok: true, id: '', message: 'Connection saved', error: null };
}
