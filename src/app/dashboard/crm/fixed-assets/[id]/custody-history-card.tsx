import { Card, CardHeader, CardTitle, CardBody } from '@/components/sabcrm/20ui/compat';
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
        <CardHeader>
          <CardTitle>Custody history</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-[13px] text-[var(--st-text-secondary)]">No custody changes recorded yet.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custody history</CardTitle>
      </CardHeader>
      <CardBody>
        <ol className="relative space-y-4 border-l border-[var(--st-border)] pl-4 ml-2">
          {entries.map((entry) => {
            const assigneeId = entry.diff?.custodianEmployeeId?.after;
            return (
              <li key={entry._id.toString()} className="relative">
                <span className="absolute -left-[21px] top-1.5 inline-block size-2.5 rounded-full border border-white bg-[var(--st-text)]" />
                <div className="flex flex-col gap-1 text-[13px]">
                  <span className="text-[var(--st-text-secondary)] text-[11px]">
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
                  {entry.reason && <p className="text-[var(--st-text-secondary)] text-[12px]">{entry.reason}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
