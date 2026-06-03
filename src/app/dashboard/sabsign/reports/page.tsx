'use client';

import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, Button, Input } from '@/components/zoruui';

export default function ReportsPage() {
  return (
    <EntityListShell
      title="Analytics & Reports"
      subtitle="Manage analytics & reports for your e-signature workflows."
    >
      <Card className="p-8 border border-dashed border-zoru-line flex flex-col items-center justify-center text-center">
        <h3 className="text-lg font-medium text-zoru-ink">Analytics & Reports feature coming soon.</h3>
        <p className="text-sm text-zoru-ink-muted mt-2 max-w-md">
          This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here.
        </p>
        <Button className="mt-4" variant="outline">Learn More</Button>
      </Card>
    </EntityListShell>
  );
}
