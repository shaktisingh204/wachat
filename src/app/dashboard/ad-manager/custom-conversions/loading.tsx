'use client';

import * as React from 'react';
import { Skeleton, Card, ZoruCardContent, Table, ZoruTableHeader, ZoruTableRow, ZoruTableHead, ZoruTableBody, ZoruTableCell } from '@/components/sabcrm/20ui/compat';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

export default function CustomConversionsLoading() {
  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Custom conversions" />
      <AmHeader
        title="Custom conversions"
        description="Define URL-based or rule-based conversion events without code changes."
        actions={<Skeleton className="h-10 w-40" />}
      />

      <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-48" />
      </div>

      <Card>
        <ZoruCardContent className="p-0">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Event type</ZoruTableHead>
                <ZoruTableHead>Last fired</ZoruTableHead>
                <ZoruTableHead>Default value</ZoruTableHead>
                <ZoruTableHead className="w-16" />
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <ZoruTableRow key={i}>
                  <ZoruTableCell><Skeleton className="h-5 w-32" /></ZoruTableCell>
                  <ZoruTableCell><Skeleton className="h-5 w-24" /></ZoruTableCell>
                  <ZoruTableCell><Skeleton className="h-5 w-24" /></ZoruTableCell>
                  <ZoruTableCell><Skeleton className="h-5 w-16" /></ZoruTableCell>
                  <ZoruTableCell><Skeleton className="h-8 w-8 rounded-full" /></ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
