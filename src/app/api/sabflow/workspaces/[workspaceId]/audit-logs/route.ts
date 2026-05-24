import { NextResponse } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { getMemberRole } from '@/lib/sabflow/workspaces/db';
import { canManageWorkspace } from '@/lib/sabflow/workspaces/permissions';
import { getAuditCollection } from '@/lib/sabflow/audit/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await params;
    const role = await getMemberRole(workspaceId, session.user._id.toString());

    if (!role || !canManageWorkspace(role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    const col = await getAuditCollection();
    const filter = { workspaceId };

    const [docs, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    const entries = docs.map((d) => ({
      id: d._id.toHexString(),
      userId: d.userId,
      action: d.action,
      target: d.target,
      metadata: d.metadata,
      createdAt: d.createdAt,
      ipAddress: d.ipAddress,
      userAgent: d.userAgent,
    }));

    return NextResponse.json({ entries, total });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
