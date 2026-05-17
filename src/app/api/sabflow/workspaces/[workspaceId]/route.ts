/**
 * GET    /api/sabflow/workspaces/[workspaceId]  → Workspace (any member)
 * PATCH  /api/sabflow/workspaces/[workspaceId]  → update name / slug / icon / plan (owner)
 * DELETE /api/sabflow/workspaces/[workspaceId]  → delete workspace (owner only)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import {
  deleteWorkspace,
  getMemberRole,
  getWorkspaceById,
  updateWorkspace,
} from '@/lib/sabflow/workspaces/db';
import {
  canManageWorkspace,
  canViewFlow,
} from '@/lib/sabflow/workspaces/permissions';
import type { WorkspaceRole } from '@/lib/sabflow/workspaces/types';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export const dynamic = 'force-dynamic';

type AuthzResult =
  | { ok: true; userId: string; role: WorkspaceRole }
  | { ok: false; status: number; error: string };

async function authorize(workspaceId: string): Promise<AuthzResult> {
  const session = await getSession();
  if (!session?.user) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }
  const userId = session.user._id.toString();
  const role = await getMemberRole(workspaceId, userId);
  if (!role) {
    return { ok: false, status: 403, error: 'Not a member of this workspace' };
  }
  return { ok: true, userId, role };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const authz = await authorize(workspaceId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  if (!canViewFlow(authz.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  return NextResponse.json({ workspace, role: authz.role });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const authz = await authorize(workspaceId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  if (!canManageWorkspace(authz.role)) {
    return NextResponse.json(
      { error: 'Only the workspace owner can update these settings' },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    slug?: unknown;
    iconUrl?: unknown;
    plan?: unknown;
  };
  const nextName = typeof body.name === 'string' ? body.name : undefined;
  const nextSlug = typeof body.slug === 'string' ? body.slug : undefined;
  const nextIconUrl = typeof body.iconUrl === 'string' ? body.iconUrl : undefined;
  const nextPlan =
    body.plan === 'free' ||
    body.plan === 'starter' ||
    body.plan === 'pro' ||
    body.plan === 'enterprise'
      ? body.plan
      : undefined;

  await updateWorkspace(workspaceId, {
    name: nextName,
    slug: nextSlug,
    iconUrl: nextIconUrl,
    plan: nextPlan,
  });

  const workspace = await getWorkspaceById(workspaceId);

  if (nextPlan !== undefined) {
    void recordFlowAction('workspace.plan.changed', {
      userId: authz.userId,
      workspaceId,
      target: workspaceId,
      metadata: { plan: nextPlan },
      request,
    });
  }
  if (
    nextName !== undefined ||
    nextSlug !== undefined ||
    nextIconUrl !== undefined
  ) {
    void recordFlowAction('workspace.settings.updated', {
      userId: authz.userId,
      workspaceId,
      target: workspaceId,
      metadata: { name: nextName, slug: nextSlug, iconUrl: nextIconUrl },
      request,
    });
  }

  return NextResponse.json({ workspace });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;
  const authz = await authorize(workspaceId);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  if (!canManageWorkspace(authz.role)) {
    return NextResponse.json(
      { error: 'Only the workspace owner can delete this workspace' },
      { status: 403 },
    );
  }
  await deleteWorkspace(workspaceId);
  void recordFlowAction('workspace.deleted', {
    userId: authz.userId,
    workspaceId,
    target: workspaceId,
    request,
  });
  return NextResponse.json({ ok: true });
}
