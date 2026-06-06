'use client';

import * as React from 'react';
import { Skeleton, Card, CardBody, Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';
import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';

export default function CustomConversionsLoading() {
  return (
    <div className="space-y-6">
      <AmBreadcrumb page="Custom conversions" />
      <AmHeader
        title="Custom conversions"
        description="Define URL-based or rule-based conversion events without code changes."
        actions={<Skeleton height={40} width={160} />}
      />

      <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
        <Skeleton height={16} width={16} />
        <Skeleton height={16} width={192} />
      </div>

      <Card padding="none">
        <CardBody>
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Event type</Th>
                <Th>Last fired</Th>
                <Th>Default value</Th>
                <Th width={64} align="right">
                  <span className="sr-only">Row actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <Tr key={i}>
                  <Td><Skeleton height={20} width={128} /></Td>
                  <Td><Skeleton height={20} width={96} /></Td>
                  <Td><Skeleton height={20} width={96} /></Td>
                  <Td><Skeleton height={20} width={64} /></Td>
                  <Td align="right"><Skeleton circle width={32} /></Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
