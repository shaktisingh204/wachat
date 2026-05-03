export const dynamic = 'force-dynamic';

import { Cake, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { ClayBadge, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { StatCard } from '../_components/report-toolbar';
import { getUpcomingBirthdays } from '@/app/actions/worksuite/reports.actions';

export default async function BirthdayAnniversaryPage(props: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await props.searchParams;
  const days = sp.days ? parseInt(sp.days) : 30;
  const rows = await getUpcomingBirthdays(days);

  const birthdays = rows.filter((r) => r.kind === 'birthday');
  const anniversaries = rows.filter((r) => r.kind === 'anniversary');

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Birthdays & Anniversaries"
        subtitle={`Upcoming in the next ${days} days.`}
        icon={Cake}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Birthdays" value={String(birthdays.length)} tone="blue" />
        <StatCard
          label="Work anniversaries"
          value={String(anniversaries.length)}
          tone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClayCard>
          <div className="mb-3 flex items-center gap-2">
            <Cake className="h-4 w-4 text-accent-foreground" />
            <h2 className="text-[16px] font-semibold text-foreground">
              Birthdays
            </h2>
          </div>
          {birthdays.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              None in this window.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {birthdays.map((r) => (
                <li
                  key={`${r.employeeId}-b`}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-[13px] font-medium text-foreground">
                    {r.employeeName}
                  </span>
                  <ClayBadge tone="blue">
                    {format(new Date(r.date), 'PP')}
                  </ClayBadge>
                </li>
              ))}
            </ul>
          )}
        </ClayCard>

        <ClayCard>
          <div className="mb-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-accent-foreground" />
            <h2 className="text-[16px] font-semibold text-foreground">
              Anniversaries
            </h2>
          </div>
          {anniversaries.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              None in this window.
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {anniversaries.map((r) => (
                <li
                  key={`${r.employeeId}-a`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-foreground">
                      {r.employeeName}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      {r.years ?? '—'}{' '}
                      {r.years === 1 ? 'year' : 'years'}
                    </div>
                  </div>
                  <ClayBadge tone="green">
                    {format(new Date(r.date), 'PP')}
                  </ClayBadge>
                </li>
              ))}
            </ul>
          )}
        </ClayCard>
      </div>
    </div>
  );
}
