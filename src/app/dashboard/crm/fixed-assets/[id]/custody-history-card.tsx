import { Card, ZoruCardHeader, ZoruCardTitle, ZoruCardContent } from '@/components/zoruui';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { EntityPickerChip } from '@/components/crm/entity-picker';

export async function CustodyHistoryCard({ assetId }: { assetId: string }) {
  const session = await getSession();
  if (!session?.user?._id) return null;

  let entries: any[] = [];
  try {
    const { db } = await connectToDatabase();
    entries = await db.collection('crm_audit_log')
      .find({
        tenantUserId: String(session.user._id),
        entityKind: 'fixed_asset',
        entityId: assetId,
        action: 'assign'
      })
      .sort({ createdAt: -1 })
      .toArray();
  } catch (e) {
    console.error(e);
  }

  if (entries.length === 0) {
    return (
      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Custody history</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          <p className="text-[13px] text-zoru-ink-muted">No custody changes recorded yet.</p>
        </ZoruCardContent>
      </Card>
    );
  }

  return (
    <Card>
      <ZoruCardHeader>
        <ZoruCardTitle>Custody history</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ol className="relative space-y-4 border-l border-zoru-line pl-4 ml-2">
          {entries.map((entry) => {
            const assigneeId = entry.diff?.custodianEmployeeId?.after;
            return (
              <li key={entry._id.toString()} className="relative">
                <span className="absolute -left-[21px] top-1.5 inline-block size-2.5 rounded-full border border-white bg-zoru-primary" />
                <div className="flex flex-col gap-1 text-[13px]">
                  <span className="text-zoru-ink-muted text-[11px]">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  <div>
                    {assigneeId ? (
                      <div className="flex items-center gap-2">
                        Assigned to <EntityPickerChip entity="employee" id={assigneeId} />
                      </div>
                    ) : (
                      <span>Unassigned</span>
                    )}
                  </div>
                  {entry.reason && <p className="text-zoru-ink-muted text-[12px]">{entry.reason}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </ZoruCardContent>
    </Card>
  );
}
