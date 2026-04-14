'use client';

import * as React from 'react';
import Link from 'next/link';
import { Users, ArrowRight, Mail, Phone } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';

type Employee = {
  _id: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  email?: string;
  phone?: string;
  departmentName?: string;
  designationName?: string;
  status?: string;
  [k: string]: any;
};

export default function DirectoryPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const list = await getCrmEmployees();
        setRows(Array.isArray(list) ? (list as Employee[]) : []);
      } catch (e) {
        console.error('Failed to load employees:', e);
        setFailed(true);
      }
    });
  }, []);

  const empty = !isLoading && rows.length === 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Employee Directory"
        subtitle="A read-only view of every employee in your organization."
        icon={Users}
        actions={
          <Link href="/dashboard/crm/hr-payroll/employees">
            <ClayButton
              variant="obsidian"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
            >
              Manage Employees
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        {isLoading && rows.length === 0 ? (
          <div className="flex flex-col gap-3 p-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : empty || failed ? (
          <div className="flex flex-col items-start gap-3 p-8">
            <h3 className="text-[15px] font-semibold text-clay-ink">
              No employees yet
            </h3>
            <p className="max-w-xl text-[13px] text-clay-ink-muted">
              Employee data will appear here once added via HR-Payroll →
              Employees. The directory shows a read-only roster sourced from
              your employee records.
            </p>
            <Link href="/dashboard/crm/hr-payroll/employees">
              <ClayButton
                variant="obsidian"
                trailing={<ArrowRight className="h-4 w-4" strokeWidth={1.75} />}
              >
                Go to Employees
              </ClayButton>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-clay-border">
            {rows.map((e) => {
              const name =
                [e.firstName, e.lastName].filter(Boolean).join(' ') ||
                e.employeeId ||
                'Unnamed';
              return (
                <div
                  key={e._id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-rose-soft text-[13px] font-semibold text-clay-rose-ink">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-clay-ink">
                        {name}
                      </div>
                      <div className="truncate text-[12px] text-clay-ink-muted">
                        {e.designationName || '—'}
                        {e.departmentName ? ` · ${e.departmentName}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[12px] text-clay-ink-muted">
                    {e.email ? (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {e.email}
                      </span>
                    ) : null}
                    {e.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {e.phone}
                      </span>
                    ) : null}
                    {e.status ? (
                      <ClayBadge tone="neutral">{e.status}</ClayBadge>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ClayCard>
    </div>
  );
}
