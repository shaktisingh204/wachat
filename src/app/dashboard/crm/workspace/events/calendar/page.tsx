'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getEvents } from '@/app/actions/worksuite/knowledge.actions';
import type { WsEvent } from '@/lib/worksuite/knowledge-types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EventsCalendarPage() {
  const [events, setEvents] = React.useState<(WsEvent & { _id: string })[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [month, setMonth] = React.useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  React.useEffect(() => {
    getEvents()
      .then((r) => setEvents(r as any))
      .finally(() => setLoading(false));
  }, []);

  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const firstDayOfMonth = new Date(year, monthIdx, 1);
  const firstWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDay = React.useMemo(() => {
    const map = new Map<number, (WsEvent & { _id: string })[]>();
    for (const e of events) {
      const d = new Date(e.start_date_time);
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() === year && d.getMonth() === monthIdx) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(e);
      }
    }
    return map;
  }, [events, year, monthIdx]);

  const prev = () => setMonth(new Date(year, monthIdx - 1, 1));
  const next = () => setMonth(new Date(year, monthIdx + 1, 1));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={month.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
        subtitle="Monthly event calendar."
        icon={CalendarDays}
        actions={
          <div className="flex items-center gap-2">
            <ClayButton variant="pill" size="icon" onClick={prev}>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </ClayButton>
            <ClayButton variant="pill" size="icon" onClick={next}>
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </ClayButton>
          </div>
        }
      />

      {loading ? (
        <ClayCard className="flex items-center justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        </ClayCard>
      ) : (
        <ClayCard>
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((d, i) => {
              const dayEvents = d ? eventsByDay.get(d) || [] : [];
              return (
                <div
                  key={i}
                  className={
                    'min-h-[88px] rounded-lg border p-1.5 text-[12px] ' +
                    (d
                      ? 'bg-card border-border'
                      : 'bg-secondary border-transparent')
                  }
                >
                  {d ? (
                    <>
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{d}</div>
                      <div className="flex flex-col gap-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <Link
                            key={e._id}
                            href={`/dashboard/crm/workspace/events/${e._id}`}
                            className="truncate"
                          >
                            <ClayBadge tone="rose-soft" className="w-full justify-start truncate">
                              {e.event_name}
                            </ClayBadge>
                          </Link>
                        ))}
                        {dayEvents.length > 3 ? (
                          <span className="text-[10.5px] text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </ClayCard>
      )}
    </div>
  );
}
