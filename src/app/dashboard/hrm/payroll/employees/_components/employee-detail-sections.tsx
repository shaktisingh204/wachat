import type {
  CrmEmployeeDoc,
} from '@/lib/rust-client/crm-employees';
import { crmAttendanceApi } from '@/lib/rust-client/crm-attendance';
import { crmLeavesApi } from '@/lib/rust-client/crm-leaves';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { Employee360Console } from './employee-360-console';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

interface EmployeeDetailSectionsProps {
  employee: CrmEmployeeDoc;
  customFields: WsCustomField[];
}

export async function EmployeeDetailSections({
  employee,
  customFields,
}: EmployeeDetailSectionsProps) {
  const employeeIdStr = String(employee._id);

  // Hydrate the attendance + leave previews server-side so the section
  // body renders without a client-side spinner. Failures degrade to an
  // empty state — they should never block the page render.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  
  const [attendance30d, recentLeaves] = await Promise.all([
    crmAttendanceApi
      .list({ employeeId: employeeIdStr, dateFrom: thirtyDaysAgo, limit: 100 })
      .catch(() => []),
    crmLeavesApi
      .list({ employeeId: employeeIdStr, limit: 10 })
      .catch(() => []),
  ]);

  return (
    <Employee360Console
      employee={employee}
      customFields={customFields}
      attendance30d={attendance30d}
      recentLeaves={recentLeaves}
      auditTimeline={<EntityAuditTimeline entityKind="employee" entityId={employeeIdStr} />}
    />
  );
}
