'use server';

/**
 * SabLens — AR remote-support server actions.
 *
 * Thin wrappers around the Rust crates `sablens-sessions`,
 * `sablens-annotations`, `sablens-frames`, `sablens-actions-log`,
 * `sablens-chat`, `sablens-devices`.
 *
 * Auth model:
 *   - Technician CRUD: requires a SabNode session (`getSession()`).
 *   - Customer-facing token endpoints (`redeemSablensCustomerToken`,
 *     `joinSablensCustomerSession`) are UNAUTHENTICATED — keyed only on
 *     the opaque `customerJoinToken` from the public `/lens/<token>`
 *     route.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sablensSessionsApi,
  type SablensPublicSessionView,
  type SablensSessionCreateInput,
  type SablensSessionDoc,
  type SablensSessionListParams,
  type SablensSessionListResponse,
  type SablensSessionUpdateInput,
} from '@/lib/rust-client/sablens-sessions';
import {
  sablensAnnotationsApi,
  type SablensAnnotationCreateInput,
  type SablensAnnotationDoc,
  type SablensAnnotationListParams,
  type SablensAnnotationListResponse,
} from '@/lib/rust-client/sablens-annotations';
import {
  sablensFramesApi,
  type SablensFrameDoc,
  type SablensFrameListParams,
  type SablensFrameListResponse,
} from '@/lib/rust-client/sablens-frames';
import {
  sablensActionsLogApi,
  type SablensActionLogAppendInput,
  type SablensActionLogDoc,
  type SablensActionLogListParams,
  type SablensActionLogListResponse,
} from '@/lib/rust-client/sablens-actions-log';
import {
  sablensChatApi,
  type SablensChatListParams,
  type SablensChatListResponse,
  type SablensChatMessageDoc,
  type SablensChatSendInput,
} from '@/lib/rust-client/sablens-chat';
import {
  sablensDevicesApi,
  type SablensDeviceDoc,
  type SablensDeviceListParams,
  type SablensDeviceListResponse,
  type SablensDeviceRegisterInput,
  type SablensDeviceUpdateInput,
} from '@/lib/rust-client/sablens-devices';

// ---------------------------------------------------------------------------
// ActionResult plumbing
// ---------------------------------------------------------------------------

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function err(e: unknown): { ok: false; error: string } {
  if (e instanceof RustApiError) return { ok: false, error: e.message };
  return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
}

async function requireSession(): Promise<{ userId: string } | null> {
  const s = await getSession();
  return s?.user?._id ? { userId: String(s.user._id) } : null;
}

function revalidateSablens(sessionId?: string): void {
  revalidatePath('/dashboard/sablens', 'layout');
  if (sessionId) {
    revalidatePath(`/dashboard/sablens/${sessionId}`, 'layout');
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function listSablensSessions(
  params?: SablensSessionListParams,
): Promise<ActionResult<SablensSessionListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensSessionsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function getSablensSession(
  id: string,
): Promise<ActionResult<SablensSessionDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensSessionsApi.getById(id) };
  } catch (e) {
    return err(e);
  }
}

export async function createSablensSession(
  input: SablensSessionCreateInput,
): Promise<ActionResult<SablensSessionDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensSessionsApi.create(input);
    revalidateSablens(res.id);
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function updateSablensSession(
  id: string,
  patch: SablensSessionUpdateInput,
): Promise<ActionResult<SablensSessionDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const after = await sablensSessionsApi.update(id, patch);
    revalidateSablens(id);
    return { ok: true, data: after };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSablensSession(
  id: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensSessionsApi.delete(id);
    revalidateSablens();
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

/** Flip a session to `active` + stamp `startedAt`. */
export async function startSablensSession(args: {
  sessionId: string;
}): Promise<ActionResult<SablensSessionDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const after = await sablensSessionsApi.start(args.sessionId);
    revalidateSablens(args.sessionId);
    return { ok: true, data: after };
  } catch (e) {
    return err(e);
  }
}

export async function endSablensSession(
  id: string,
): Promise<ActionResult<SablensSessionDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const after = await sablensSessionsApi.end(id);
    revalidateSablens(id);
    return { ok: true, data: after };
  } catch (e) {
    return err(e);
  }
}

/** Mint a fresh `customerJoinToken` (invalidates the previous link). */
export async function issueSablensCustomerToken(
  sessionId: string,
): Promise<ActionResult<{ customerJoinToken: string }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensSessionsApi.reissueCustomerToken(sessionId);
    revalidateSablens(sessionId);
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

/**
 * Customer-facing — exchange the opaque `customerJoinToken` for a
 * sanitized session view. UNAUTHENTICATED.
 */
export async function redeemSablensCustomerToken(
  token: string,
): Promise<ActionResult<SablensPublicSessionView>> {
  try {
    return { ok: true, data: await sablensSessionsApi.publicView(token) };
  } catch (e) {
    return err(e);
  }
}

/**
 * Customer-facing — mark the session as joined (flips to `waiting` if
 * still `scheduled`). UNAUTHENTICATED.
 */
export async function joinSablensCustomerSession(
  token: string,
): Promise<ActionResult<SablensPublicSessionView>> {
  try {
    return { ok: true, data: await sablensSessionsApi.publicJoin(token) };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------------------
// Snapshots — captured camera frames
// ---------------------------------------------------------------------------

export async function listSablensFrames(
  params?: SablensFrameListParams,
): Promise<ActionResult<SablensFrameListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensFramesApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

/**
 * Record a captured camera frame snapshot. `fileId` is a SabFiles id —
 * the SabFilePicker / upload-button hands it to us.
 */
export async function recordSablensSnapshot(
  sessionId: string,
  fileId: string,
  sensorInfo?: Record<string, unknown>,
): Promise<ActionResult<SablensFrameDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensFramesApi.create({
      sessionId,
      fileId,
      sensorInfoJson: sensorInfo,
    });
    // Mirror onto the session's snapshot list.
    await sablensSessionsApi.appendSnapshot(sessionId, fileId).catch(() => {});
    // Action-log entry — fire-and-forget.
    await sablensActionsLogApi
      .append({
        sessionId,
        action: 'snapshot',
        payloadJson: { fileId, frameId: res.id },
      })
      .catch(() => {});
    revalidateSablens(sessionId);
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

export async function listSablensAnnotations(
  params?: SablensAnnotationListParams,
): Promise<ActionResult<SablensAnnotationListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensAnnotationsApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function addSablensAnnotation(
  args: SablensAnnotationCreateInput,
): Promise<ActionResult<SablensAnnotationDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensAnnotationsApi.create(args);
    await sablensActionsLogApi
      .append({
        sessionId: args.sessionId,
        action: 'annotate',
        payloadJson: { kind: args.kind, annotationId: res.id },
      })
      .catch(() => {});
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function clearSablensAnnotations(
  sessionId: string,
): Promise<ActionResult<{ deleted: number }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensAnnotationsApi.clearSession(sessionId) };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------------------
// Action log
// ---------------------------------------------------------------------------

export async function listSablensActionLog(
  params?: SablensActionLogListParams,
): Promise<ActionResult<SablensActionLogListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensActionsLogApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function appendSablensActionLog(
  args: SablensActionLogAppendInput,
): Promise<ActionResult<SablensActionLogDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensActionsLogApi.append(args);
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export async function listSablensChat(
  params?: SablensChatListParams,
): Promise<ActionResult<SablensChatListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensChatApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function sendSablensChat(
  args: SablensChatSendInput,
): Promise<ActionResult<SablensChatMessageDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensChatApi.send(args);
    await sablensActionsLogApi
      .append({
        sessionId: args.sessionId,
        action: 'chat',
        payloadJson: { messageId: res.id, body: args.body.slice(0, 80) },
      })
      .catch(() => {});
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export async function listSablensDevices(
  params?: SablensDeviceListParams,
): Promise<ActionResult<SablensDeviceListResponse>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    return { ok: true, data: await sablensDevicesApi.list(params) };
  } catch (e) {
    return err(e);
  }
}

export async function registerSablensDevice(
  args: SablensDeviceRegisterInput,
): Promise<ActionResult<SablensDeviceDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensDevicesApi.register(args);
    revalidatePath('/dashboard/sablens/devices');
    return { ok: true, data: res.entity };
  } catch (e) {
    return err(e);
  }
}

export async function updateSablensDevice(
  id: string,
  patch: SablensDeviceUpdateInput,
): Promise<ActionResult<SablensDeviceDoc>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensDevicesApi.update(id, patch);
    revalidatePath('/dashboard/sablens/devices');
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

export async function deleteSablensDevice(
  id: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  if (!(await requireSession())) return { ok: false, error: 'Unauthenticated' };
  try {
    const res = await sablensDevicesApi.delete(id);
    revalidatePath('/dashboard/sablens/devices');
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}
