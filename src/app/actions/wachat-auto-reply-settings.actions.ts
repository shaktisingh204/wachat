'use server';

/**
 * Wachat auto-reply-settings server actions.
 *
 * Thin shims around the `wachatAutoReplySettingsApi` namespace (the Rust
 * crate `wachat-auto-reply-settings`, mounted at
 * `/v1/wachat/auto-reply-settings`). These replace the native-Mongo writes
 * that used to live in `src/app/actions/project.actions.ts`
 * (`handleUpdateMasterSwitch`, `handleUpdateAutoReplySettings`,
 * `handleUpdateOptInOutSettings`).
 *
 * Each body:
 *   1. unpacks `FormData` (where the legacy action did so),
 *   2. delegates to the crate endpoint,
 *   3. preserves the legacy return contract (`{ message }` / `{ error }`),
 *   4. calls `revalidatePath()` on the same paths the legacy code did.
 *
 * Imported DIRECTLY from the client module (not via the `rust-client`
 * barrel) so this slice can ship without editing `index.ts`.
 */

import { revalidatePath } from 'next/cache';

import { wachatAutoReplySettingsApi } from '@/lib/rust-client/wachat-auto-reply-settings';
import type {
    AutoReplyGeneralRule,
    AutoReplySettingsResponse,
} from '@/lib/rust-client/wachat-auto-reply-settings';
import { getErrorMessage } from '@/lib/utils';

// The legacy actions also revalidated `/dashboard/settings`; keep that and
// add the page that now reads/writes these settings.
const REVALIDATE_PATHS = ['/dashboard/settings', '/wachat/auto-reply'] as const;

function revalidateAll(): void {
    for (const p of REVALIDATE_PATHS) revalidatePath(p);
}

// =================================================================
//  READ
// =================================================================

export async function getAutoReplySettings(
    projectId: string,
): Promise<
    | { success: true; settings: AutoReplySettingsResponse }
    | { success: false; error: string }
> {
    if (!projectId) return { success: false, error: 'Missing project ID.' };
    try {
        const settings = await wachatAutoReplySettingsApi.getSettings(projectId);
        return { success: true, settings };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// =================================================================
//  MASTER SWITCH  (PATCH /master-switch)
// =================================================================

export async function updateMasterSwitch(
    projectId: string,
    isEnabled: boolean,
): Promise<{ message?: string; error?: string }> {
    if (!projectId) return { error: 'Missing project ID.' };
    try {
        await wachatAutoReplySettingsApi.updateMasterSwitch(projectId, isEnabled);
        revalidateAll();
        return {
            message: `All auto-replies have been ${isEnabled ? 'enabled' : 'disabled'}.`,
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  AUTO-REPLY SECTIONS  (welcome / inactive-hours / general / ai-assistant)
//
//  One FormData entry-point that fans the legacy `replyType` discriminator
//  out to the matching crate endpoint — preserving the existing form
//  contract (hidden `projectId` / `replyType` / `enabled` fields).
// =================================================================

export async function updateAutoReplySettings(
    _prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string | null;
    const replyType = formData.get('replyType') as string | null;
    if (!projectId || !replyType) return { error: 'Missing required data.' };

    const enabledVal = formData.get('enabled');
    const enabled = enabledVal === 'on' || enabledVal === 'true';

    try {
        switch (replyType) {
            case 'welcomeMessage': {
                await wachatAutoReplySettingsApi.updateWelcomeMessage(projectId, {
                    enabled,
                    message: (formData.get('message') as string) ?? '',
                });
                break;
            }
            case 'inactiveHours': {
                const days = [0, 1, 2, 3, 4, 5, 6].filter((day) => {
                    const val = formData.get(`day_${day}`);
                    return val === 'on' || val === 'true';
                });
                await wachatAutoReplySettingsApi.updateInactiveHours(projectId, {
                    enabled,
                    message: (formData.get('message') as string) ?? '',
                    startTime: (formData.get('startTime') as string) ?? '',
                    endTime: (formData.get('endTime') as string) ?? '',
                    timezone: (formData.get('timezone') as string) ?? '',
                    days,
                });
                break;
            }
            case 'general': {
                const repliesJSON = formData.get('replies') as string | null;
                let replies: AutoReplyGeneralRule[] = [];
                if (repliesJSON) {
                    try {
                        const parsed = JSON.parse(repliesJSON) as unknown;
                        if (Array.isArray(parsed)) {
                            replies = parsed.map((r) => {
                                const rule = (r ?? {}) as Partial<AutoReplyGeneralRule>;
                                return {
                                    id: rule.id ?? '',
                                    keywords: rule.keywords ?? '',
                                    reply: rule.reply ?? '',
                                    matchType: rule.matchType ?? 'contains',
                                };
                            });
                        }
                    } catch {
                        return { error: 'Invalid format for replies data.' };
                    }
                }
                await wachatAutoReplySettingsApi.updateGeneral(projectId, {
                    enabled,
                    replies,
                });
                break;
            }
            case 'aiAssistant': {
                const autoTransVal = formData.get('autoTranslate');
                await wachatAutoReplySettingsApi.updateAiAssistant(projectId, {
                    enabled,
                    context: (formData.get('context') as string) ?? '',
                    autoTranslate: autoTransVal === 'on' || autoTransVal === 'true',
                });
                break;
            }
            default:
                return { error: `Unknown reply type: ${replyType}` };
        }
        revalidateAll();
        return { message: 'Auto-reply settings updated successfully!' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// =================================================================
//  OPT-IN / OPT-OUT  (PUT /opt-in-out)
//
//  The legacy action split the comma-strings into arrays before writing;
//  we keep that here so the form can stay on its current FormData contract.
// =================================================================

function splitKeywords(raw: string | null): string[] {
    return (raw ?? '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
}

export async function updateOptInOutSettings(
    _prevState: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string | null;
    if (!projectId) return { error: 'Missing project ID.' };

    try {
        await wachatAutoReplySettingsApi.updateOptInOut(projectId, {
            enabled: formData.get('enabled') === 'on' || formData.get('enabled') === 'true',
            optInKeywords: splitKeywords(formData.get('optInKeywords') as string | null),
            optOutKeywords: splitKeywords(formData.get('optOutKeywords') as string | null),
            optInResponse: (formData.get('optInResponse') as string) ?? '',
            optOutResponse: (formData.get('optOutResponse') as string) ?? '',
        });
        revalidateAll();
        return { message: 'Opt-in/out settings saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
