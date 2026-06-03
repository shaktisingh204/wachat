const fs = require('fs');
const path = require('path');

const dashboardDir = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/sabsign';
const pages = [
  { path: 'audit/[id]', name: 'AuditTrailPage', title: 'Audit Trail' },
  { path: 'bulk', name: 'BulkSendPage', title: 'Bulk Send' },
  { path: 'settings', name: 'SettingsPage', title: 'E-Sign Settings' },
  { path: 'api', name: 'ApiSettingsPage', title: 'Developer API' },
  { path: 'contacts', name: 'ContactsPage', title: 'Address Book' },
  { path: 'reports', name: 'ReportsPage', title: 'Analytics & Reports' },
  { path: 'billing', name: 'BillingPage', title: 'Billing & Usage' },
  { path: 'notary', name: 'NotaryPage', title: 'Notary Journal' }
];

pages.forEach(p => {
  const dirPath = path.join(dashboardDir, p.path);
  fs.mkdirSync(dirPath, { recursive: true });
  
  const content = `'use client';

import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, Button, Input } from '@/components/zoruui';

export default function ${p.name}() {
  return (
    <EntityListShell
      title="${p.title}"
      subtitle="Manage ${p.title.toLowerCase()} for your e-signature workflows."
    >
      <Card className="p-8 border border-dashed border-zoru-line flex flex-col items-center justify-center text-center">
        <h3 className="text-lg font-medium text-zoru-ink">${p.title} feature coming soon.</h3>
        <p className="text-sm text-zoru-ink-muted mt-2 max-w-md">
          This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here.
        </p>
        <Button className="mt-4" variant="outline">Learn More</Button>
      </Card>
    </EntityListShell>
  );
}
`;
  fs.writeFileSync(path.join(dirPath, 'page.tsx'), content);
  console.log('Created: ' + p.path);
});

// Create external portal page
const portalDir = '/Users/harshkhandelwal/Downloads/sabnode/src/app/sign/[envelopeId]/[recipientId]';
fs.mkdirSync(portalDir, { recursive: true });
const portalContent = `'use client';

import * as React from 'react';
import { Button, Card, Input } from '@/components/zoruui';

export default function SigningPortalPage() {
  return (
    <div className="min-h-screen bg-zoru-background flex flex-col">
      <header className="h-16 border-b border-zoru-line flex items-center justify-between px-6 bg-zoru-surface">
        <div className="font-semibold text-lg text-zoru-ink">SabSign</div>
        <Button>Finish & Sign</Button>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-4xl w-full p-8 bg-white text-black min-h-[800px] shadow-sm">
          <h1 className="text-2xl font-bold mb-4">Document Preview</h1>
          <p className="text-gray-500">Signer view with fields will be rendered here...</p>
        </Card>
      </main>
    </div>
  );
}
`;
fs.writeFileSync(path.join(portalDir, 'page.tsx'), portalContent);
console.log('Created external portal');
