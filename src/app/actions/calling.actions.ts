'use server';

/**
 * WhatsApp Business **Calling API** server actions.
 *
 * Bodies delegate to the Rust BFF (`/v1/wachat/calling`, served by the
 * `wachat-calling` crate). The function signatures and return-type
 * contracts are preserved 1:1 so existing callers
 * (`CallingSettingsForm`, `CallingToggleSwitch`, the call-logs page)
 * keep working without changes.
 */

import type { CallingSettings } from '@/lib/definitions';
import { rustClient } from '@/lib/rust-client';
import type { SaveCallingSettingsBody } from '@/lib/rust-client/wachat-calling';
import { getErrorMessage } from '@/lib/utils';

export async function getPhoneNumberCallingSettings(
    projectId: string,
    phoneNumberId: string,
): Promise<{ settings?: CallingSettings; error?: string }> {
    try {
        const result = await rustClient.wachatCalling.getSettings(projectId, phoneNumberId);
        // Rust returns `null` when Meta has no calling settings yet — coerce
        // to undefined so callers can `result.settings?.status` safely.
        const settings = (result?.settings ?? undefined) as CallingSettings | undefined;
        return { settings };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(
    _prevState: any,
    formData: FormData,
): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    if (!projectId || !phoneNumberId) {
        return { success: false, error: 'Missing required IDs.' };
    }

    try {
        const status = (formData.get('status') as string) || '';

        // Quick toggle path — the legacy TS short-circuited when `status` was
        // present, sending only `{calling: {status}}`.
        if (status) {
            const body: SaveCallingSettingsBody = { quickStatus: status };
            await rustClient.wachatCalling.saveSettings(projectId, phoneNumberId, body);
            return { success: true };
        }

        // Full save path — pull every field out of the form and forward to
        // the Rust handler. The Rust DTO keeps every field optional so the
        // wire payload only contains what the user filled in.
        const restrictRaw = (formData.get('restrict_to_user_countries') as string) || '';
        const restrictToUserCountries = restrictRaw
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean);

        const callHoursStatus = (formData.get('call_hours_status') as string) || 'DISABLED';
        const timezoneId = (formData.get('timezone_id') as string) || '';
        const weeklyOperatingHours = JSON.parse(
            (formData.get('weekly_operating_hours') as string) || '[]',
        );
        const holidaySchedule = JSON.parse(
            (formData.get('holiday_schedule') as string) || '[]',
        );

        const sipStatus = (formData.get('sip_status') as string) || 'DISABLED';
        const sipHostname = (formData.get('sip_hostname') as string) || '';
        const sipPort = Number(formData.get('sip_port') || 0);
        const sipParamsRaw = (formData.get('sip_params') as string) || '';
        const requestUriUserParams = sipParamsRaw ? JSON.parse(sipParamsRaw) : undefined;

        const body: SaveCallingSettingsBody = {
            callIconVisibility: (formData.get('call_icon_visibility') as string) || undefined,
            restrictToUserCountries:
                restrictToUserCountries.length > 0 ? restrictToUserCountries : undefined,
            callbackPermissionStatus:
                (formData.get('callback_permission_status') as string) || undefined,
            callHours: {
                status: callHoursStatus,
                timezoneId,
                weeklyOperatingHours,
                holidaySchedule,
            },
            sip: {
                status: sipStatus,
                servers: [
                    {
                        hostname: sipHostname,
                        port: sipPort,
                        ...(requestUriUserParams ? { requestUriUserParams } : {}),
                    },
                ],
            },
        };

        await rustClient.wachatCalling.saveSettings(projectId, phoneNumberId, body);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCallLogs(projectId: string) {
    if (!projectId) return [];
    try {
        const result = await rustClient.wachatCalling.listLogs(projectId);
        return (result?.logs ?? []) as any[];
    } catch {
        return [];
    }
}
