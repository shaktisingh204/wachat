'use server';

import { rustClient } from '@/lib/rust-client';
import { revalidatePath } from 'next/cache';

// Inboxes
export async function listAdminInboxes() {
    return rustClient.sabchat.inboxes.list();
}
export async function createAdminInbox(data: any) {
    const res = await rustClient.sabchat.inboxes.create(data);
    revalidatePath('/dashboard/sabchat/admin/inboxes');
    return res;
}
export async function deleteAdminInbox(id: string) {
    const res = await rustClient.sabchat.inboxes.delete(id);
    revalidatePath('/dashboard/sabchat/admin/inboxes');
    return res;
}

// Teams
export async function listAdminTeams() {
    return rustClient.sabchatTeams.list();
}
export async function createAdminTeam(data: any) {
    const res = await rustClient.sabchatTeams.create(data);
    revalidatePath('/dashboard/sabchat/admin/teams');
    return res;
}
export async function deleteAdminTeam(id: string) {
    const res = await rustClient.sabchatTeams.delete(id);
    revalidatePath('/dashboard/sabchat/admin/teams');
    return res;
}

// Macros
export async function listAdminMacros() {
    return rustClient.sabchatMacros.list();
}
export async function createAdminMacro(data: any) {
    const res = await rustClient.sabchatMacros.create(data);
    revalidatePath('/dashboard/sabchat/admin/macros');
    return res;
}
export async function deleteAdminMacro(id: string) {
    const res = await rustClient.sabchatMacros.delete(id);
    revalidatePath('/dashboard/sabchat/admin/macros');
    return res;
}

// SLA
export async function listAdminSla() {
    return rustClient.sabchatSla.list();
}
export async function createAdminSla(data: any) {
    const res = await rustClient.sabchatSla.create(data);
    revalidatePath('/dashboard/sabchat/admin/sla');
    return res;
}
export async function deleteAdminSla(id: string) {
    const res = await rustClient.sabchatSla.delete(id);
    revalidatePath('/dashboard/sabchat/admin/sla');
    return res;
}

// Business Hours
export async function listAdminBusinessHours() {
    return rustClient.sabchatBusinessHours.list();
}
export async function createAdminBusinessHour(data: any) {
    const res = await rustClient.sabchatBusinessHours.create(data);
    revalidatePath('/dashboard/sabchat/admin/business-hours');
    return res;
}
export async function deleteAdminBusinessHour(id: string) {
    const res = await rustClient.sabchatBusinessHours.delete(id);
    revalidatePath('/dashboard/sabchat/admin/business-hours');
    return res;
}

// Dispositions
export async function listAdminDispositions() {
    return rustClient.sabchatDispositions.list();
}
export async function createAdminDisposition(data: any) {
    const res = await rustClient.sabchatDispositions.create(data);
    revalidatePath('/dashboard/sabchat/admin/dispositions');
    return res;
}
export async function deleteAdminDisposition(id: string) {
    const res = await rustClient.sabchatDispositions.delete(id);
    revalidatePath('/dashboard/sabchat/admin/dispositions');
    return res;
}

// Marketplace
export async function listMarketplaceApps() {
    return rustClient.sabchatMarketplace.list();
}
export async function installMarketplaceApp(appId: string) {
    const res = await rustClient.sabchatMarketplace.install(appId);
    revalidatePath('/dashboard/sabchat/admin/marketplace');
    return res;
}
export async function uninstallMarketplaceApp(appId: string) {
    const res = await rustClient.sabchatMarketplace.uninstall(appId);
    revalidatePath('/dashboard/sabchat/admin/marketplace');
    return res;
}

