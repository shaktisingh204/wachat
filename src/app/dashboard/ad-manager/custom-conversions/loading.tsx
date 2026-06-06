'use client';

import * as React from 'react';
import { Skeleton, Card, CardBody, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';
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
        <CardBody className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Event type</Th>
                <Th>Last fired</Th>
                <Th>Default value</Th>
                <Th className="w-16" />
              </Tr>
            </THead>
            <TBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <Tr key={i}>
                  <Td><Skeleton className="h-5 w-32" /></Td>
                  <Td><Skeleton className="h-5 w-24" /></Td>
                  <Td><Skeleton className="h-5 w-24" /></Td>
                  <Td><Skeleton className="h-5 w-16" /></Td>
                  <Td><Skeleton className="h-8 w-8 rounded-full" /></Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
