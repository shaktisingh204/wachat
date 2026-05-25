import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getWeeklyTimesheetById } from '@/app/actions/worksuite/time.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import EditWeeklyTimesheetForm from './edit-form';

export const dynamic = 'force-dynamic';


type PageProps = {
  params: Promise<{ id: string }>;
};

async function EditWeeklyTimesheetData({ id }: { id: string }) {
    const [sheet, rows] = await Promise.all([
      getWeeklyTimesheetById(id),
      getCrmEmployees(),
    ]);

    if (!sheet) {
      notFound();
    }

    const employees = (rows as any[]).map((e) => ({
      _id: String(e._id),
      firstName: e.firstName,
      lastName: e.lastName,
    }));

    return (
      <EditWeeklyTimesheetForm
        id={id}
        initialData={sheet}
        employees={employees}
      />
    );
}

export default async function EditWeeklyTimesheetPage(props: PageProps) {
  const { id } = await props.params;

  return (
    <EntityListShell
      title="Edit Weekly Timesheet"
      subtitle="Update the employee or week for this timesheet."
    >
      <Suspense
        fallback={
          <div className="py-12 text-center text-[13px] text-zoru-ink-muted bg-zoru-surface-1 rounded-lg border border-zoru-line animate-pulse">
            Loading timesheet details…
          </div>
        }
      >
        <EditWeeklyTimesheetData id={id} />
      </Suspense>
    </EntityListShell>
  );
}
