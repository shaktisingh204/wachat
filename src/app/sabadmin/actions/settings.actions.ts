'use server';

import { revalidatePath } from 'next/cache';

import {
  getSabAdminContext,
  getOrInitSabAdminSettings,
  updateSabAdminSettings,
  resolveMailWorkspaceId,
  listVerifiedDomains,
  listOwnerProjects,
  pickDefaultDomain,
} from '@/lib/sabadmin/tenant';
import { isStalwartEnabled } from '@/lib/sabmail/hosted-provider';
import { isHostedAuthConfigured } from '@/lib/auth';
import { writeSabAdminAudit } from '@/lib/sabadmin/audit';
import type { ActionResult, SettingsView } from '@/lib/sabadmin/dto';
import type { DomainMode, UsernameConvention } from '@/lib/sabadmin/types';

/** Build the serializable settings view (incl. resolved domains + capability flags). */
export async function getSabAdminSettingsView(): Promise<SettingsView | null> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return null;
  const ctx = ctxRes.ctx;

  const settings = await getOrInitSabAdminSettings(ctx.ownerUserId);
  const mailWorkspaceId = await resolveMailWorkspaceId(ctx.ownerUserId, settings);
  const verifiedDomains = mailWorkspaceId ? await listVerifiedDomains(mailWorkspaceId) : [];
  const defaultDomain = pickDefaultDomain(verifiedDomains, settings);
  const projects = await listOwnerProjects(ctx.ownerUserId);

  return {
    ownerUserId: ctx.ownerUserId,
    mailWorkspaceId: mailWorkspaceId ?? null,
    domainMode: settings.domainMode,
    sharedDomain: settings.sharedDomain ?? null,
    orgSlug: settings.orgSlug ?? null,
    usernameConvention: settings.usernameConvention,
    defaultPackageId: settings.defaultPackageId ?? null,
    sabcrmProjectId: settings.sabcrmProjectId ?? null,
    projects,
    verifiedDomains,
    defaultDomain,
    hostedMailConfigured: isStalwartEnabled(),
    hostedAuthConfigured: isHostedAuthConfigured(),
  };
}

/** Persist a settings change. */
export async function updateSabAdminSettingsAction(patch: {
  mailWorkspaceId?: string;
  domainMode?: DomainMode;
  sharedDomain?: string;
  orgSlug?: string;
  usernameConvention?: UsernameConvention;
  defaultPackageId?: string;
  sabcrmProjectId?: string;
}): Promise<ActionResult> {
  const ctxRes = await getSabAdminContext();
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };
  const ctx = ctxRes.ctx;

  await updateSabAdminSettings(ctx.ownerUserId, patch);
  await writeSabAdminAudit(ctx, 'settings_update', 'Updated Admin Center settings', undefined, patch);
  revalidatePath('/sabadmin/settings');
  revalidatePath('/sabadmin/people');
  return { ok: true };
}
