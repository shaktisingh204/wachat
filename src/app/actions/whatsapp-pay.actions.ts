'use server';

/**
 * WhatsApp Pay payment-configuration server actions.
 *
 * Phase 6 of the SabNode TS-to-Rust port: every body has been replaced
 * with a thin shim around `rustClient.wachatPay.*`. The TS surface
 * (return shapes, formData parsing, `revalidatePath` calls) is preserved
 * exactly so downstream `useActionState` hooks and callers don't change.
 *
 * The Rust handlers live in `wachat-pay` and are mounted at
 * `/v1/wachat/pay`. Tenant scoping (project must belong to the calling
 * user) is enforced server-side in Rust.
 */

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';

import type { PaymentConfiguration, Project } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getPaymentConfigurations(
    projectId: string,
): Promise<{ configurations: PaymentConfiguration[]; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.listConfigurations(projectId);
        return { configurations: (r.configurations as unknown as PaymentConfiguration[]) ?? [] };
    } catch (e) {
        return { configurations: [], error: getErrorMessage(e) };
    }
}

export async function getPaymentConfigurationByName(
    projectId: string,
    configName: string,
): Promise<{ configuration?: PaymentConfiguration; error?: string }> {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.getConfiguration(projectId, configName);
        return { configuration: r.configuration as unknown as PaymentConfiguration };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleCreatePaymentConfiguration(_prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const providerName = formData.get('provider_name') as string;

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.createConfiguration(projectId, {
            configurationName: formData.get('configuration_name') as string,
            purposeCode: formData.get('purpose_code') as string,
            merchantCategoryCode: formData.get('merchant_category_code') as string,
            providerName,
            merchantVpa:
                providerName === 'upi_vpa'
                    ? ((formData.get('merchant_vpa') as string) ?? undefined)
                    : undefined,
            redirectUrl:
                providerName === 'upi_vpa'
                    ? undefined
                    : ((formData.get('redirect_url') as string) ?? undefined),
        });

        revalidatePath('/wachat/whatsapp-pay/settings');
        return { message: r.message, oauth_url: r.oauthUrl ?? null };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateDataEndpoint(_prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const configName = formData.get('configurationName') as string;
    const dataEndpointUrl = formData.get('dataEndpointUrl') as string;

    if (!dataEndpointUrl) {
        return { error: 'Data Endpoint URL is required.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatPay.updateDataEndpoint(projectId, configName, {
            dataEndpointUrl,
        });

        revalidatePath('/wachat/whatsapp-pay/settings');
        return { message: 'Data endpoint updated successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleRegenerateOauthLink(_prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const configName = formData.get('configuration_name') as string;
    const redirectUrl = formData.get('redirect_url') as string;

    if (!redirectUrl || !configName) {
        return { error: 'Configuration name and redirect URL are required.' };
    }

    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.regenerateOauth(projectId, configName, {
            redirectUrl,
        });
        return { oauth_url: r.oauthUrl };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleDeletePaymentConfiguration(projectId: string, configName: string) {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        const r = await rustClient.wachatPay.deleteConfiguration(projectId, configName);
        if (r.success) {
            revalidatePath('/wachat/whatsapp-pay/settings');
            return { success: true };
        }
        return { success: false, error: 'Meta API indicated failure.' };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handlePaymentConfigurationUpdate(
    project: WithId<Project>,
    updateValue: any,
) {
    try {
        const { rustClient } = await import('@/lib/rust-client');
        await rustClient.wachatPay.syncLocal(String(project._id), updateValue.configuration_name, {
            configurationName: updateValue.configuration_name,
            updateValue,
        });
        revalidatePath('/wachat/whatsapp-pay/settings');
    } catch {
        // Webhook-side fire-and-forget; matches legacy `.catch(e => ...)`
        // pattern on the caller. Errors are intentionally swallowed here so
        // the webhook ack isn't blocked on a Mongo write hiccup.
    }
}
