'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import {
  ReportExportButton,
  type ReportExportButtonProps,
} from './report-export-button';
import type { TpReportProject, TpReportOwner } from '@/app/actions/crm-reports.actions.types';

export interface TpReportToolbarProps {
  from?: string;
  to?: string;
  projectId?: string;
  ownerId?: string;
  projects: TpReportProject[];
  owners: TpReportOwner[];
  hideDateRange?: boolean;
  exportProps?: ReportExportButtonProps;
}

// Radix Select forbids an empty-string item value, so an "all" sentinel stands
// in for "no filter" and is mapped back to an empty query param on apply.
const ALL = '__all__';

export function TpReportToolbar({
  from,
  to,
  projectId,
  ownerId,
  projects,
  owners,
  hideDateRange,
  exportProps,
}: TpReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [fromValue, setFromValue] = React.useState(from ?? '');
  const [toValue, setToValue] = React.useState(to ?? '');
  const [projectValue, setProjectValue] = React.useState(projectId || ALL);
  const [ownerValue, setOwnerValue] = React.useState(ownerId || ALL);

  const onApply = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const params = new URLSearchParams(sp.toString());
      const setOrDelete = (key: string, value: string) => {
        if (value) params.set(key, value);
        else params.delete(key);
      };
      if (!hideDateRange) {
        setOrDelete('from', fromValue);
        setOrDelete('to', toValue);
      }
      if (projects.length > 0) {
        setOrDelete('projectId', projectValue === ALL ? '' : projectValue);
      }
      if (owners.length > 0) {
        setOrDelete('ownerId', ownerValue === ALL ? '' : ownerValue);
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [
      sp,
      hideDateRange,
      fromValue,
      toValue,
      projects.length,
      projectValue,
      owners.length,
      ownerValue,
      router,
      pathname,
    ],
  );

  const onRefresh = React.useCallback(() => {
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    router.refresh();
  }, [router, pathname, sp]);

  return (
    <form
      onSubmit={onApply}
      className="flex flex-wrap items-end gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2"
    >
      {!hideDateRange ? (
        <>
          <Field label="From">
            <Input
              type="date"
              inputSize="sm"
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              inputSize="sm"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
            />
          </Field>
        </>
      ) : null}

      {projects.length > 0 ? (
        <Field label="Project">
          <Select value={projectValue} onValueChange={setProjectValue}>
            <SelectTrigger aria-label="Project" className="min-w-[160px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {owners.length > 0 ? (
        <Field label="Owner">
          <Select value={ownerValue} onValueChange={setOwnerValue}>
            <SelectTrigger aria-label="Owner" className="min-w-[140px]">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All owners</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Button type="submit" size="sm" variant="primary">
        Apply
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        iconLeft={RefreshCw}
        onClick={onRefresh}
      >
        Refresh
      </Button>
      {exportProps ? <ReportExportButton {...exportProps} /> : null}
    </form>
  );
}
