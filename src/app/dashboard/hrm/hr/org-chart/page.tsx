import * as React from 'react';
import Link from 'next/link';
import { Button, Skeleton, Card } from '@/components/sabcrm/20ui';
import { ArrowRight } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import { OrgChartClient, type Employee } from './_components/org-chart-client';

export const dynamic = 'force-dynamic';

async function OrgChartContainer() {
  const list = await getCrmEmployees();
  const employees = Array.isArray(list) ? (list as Employee[]) : [];
  return <OrgChartClient employees={employees} />;
}

export default function OrgChartPage() {
  return (
    <EntityListShell
      title="Org Chart"
      subtitle="Reporting hierarchy built from employee records."
      primaryAction={
        <Link href="/dashboard/hrm/hr/directory">
          <Button variant="outline">
            View Directory
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </Link>
      }
    >
      <React.Suspense
        fallback={
          <Card>
            <div className="flex flex-col gap-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className={`h-10 w-full ${i > 0 ? 'ml-10' : ''}`} />
              ))}
            </div>
          </Card>
        }
      >
        <OrgChartContainer />
      </React.Suspense>
    </EntityListShell>
  );
}
