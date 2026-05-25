'use server';

import { revalidatePath } from 'next/cache';
import { writeAuditEntry } from '@/lib/audit-log';
import { getSession } from '@/lib/auth';

export async function addManualLogEntry(loanId: string, message: string, actionType: string = 'comment') {
    const session = await getSession();
    if (!session?.user?._id) throw new Error('Unauthorized');

    const tenantUserId = String(session.user._id);
    
    await writeAuditEntry({
        tenantUserId,
        actorId: tenantUserId,
        action: actionType,
        entityKind: 'loan',
        entityId: loanId,
        reason: message,
    });

    revalidatePath(`/dashboard/crm/loans/${loanId}/activity`);
}
