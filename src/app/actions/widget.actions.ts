'use server';

import { revalidatePath } from 'next/cache';
import { rustClient, RustApiError } from '@/lib/rust-client';
import type { SaveWidgetSettingsBody } from '@/lib/rust-client/wachat-config';
import { getErrorMessage } from '@/lib/utils';

export async function saveWidgetSettings(
    prevState: any,
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) {
        return { error: "Invalid project ID." };
    }

    try {
        const borderRadiusRaw = formData.get('borderRadius');
        const paddingRaw = formData.get('padding');

        const body: SaveWidgetSettingsBody = {
            phoneNumber: (formData.get('phoneNumber') as string) ?? undefined,
            prefilledMessage: (formData.get('prefilledMessage') as string) ?? undefined,
            position: (formData.get('position') as 'bottom-left' | 'bottom-right') ?? undefined,
            buttonColor: (formData.get('buttonColor') as string) ?? undefined,
            headerTitle: (formData.get('headerTitle') as string) ?? undefined,
            headerSubtitle: (formData.get('headerSubtitle') as string) ?? undefined,
            headerAvatarUrl: (formData.get('headerAvatarUrl') as string) ?? undefined,
            welcomeMessage: (formData.get('welcomeMessage') as string) ?? undefined,
            ctaText: (formData.get('ctaText') as string) ?? undefined,
            borderRadius: borderRadiusRaw != null ? parseInt(borderRadiusRaw as string, 10) : 0,
            padding: paddingRaw != null ? parseInt(paddingRaw as string, 10) : 0,
            textColor: (formData.get('textColor') as string) ?? undefined,
            buttonTextColor: (formData.get('buttonTextColor') as string) ?? undefined,
        };

        await rustClient.wachatConfig.saveWidgetSettings(projectId, body);

        revalidatePath(`/wachat/integrations/whatsapp-widget-generator`);
        return { message: "Widget settings saved successfully." };

    } catch (e) {
        if (e instanceof RustApiError) {
            return { error: e.message };
        }
        return { error: getErrorMessage(e) };
    }
}
