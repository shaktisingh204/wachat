/**
 * Create quotation — `/dashboard/crm/sales/quotations/new` (§1D.3 rebuild
 * — Phase 1.1B Wave 2 partial).
 *
 * Server component. Fetches the tenant's quotation custom-field
 * definitions, then hands off to the canonical `<QuotationForm>`. The
 * form supports smart defaults from `?fromKind=deal&fromId=…` and
 * `?fromKind=lead&fromId=…` and renders the §1D.3 section layout
 * (Header · Customer · Line items · Summary · Notes · Terms ·
 * Attachments · Custom fields). Sticky action bar with Save · Save &
 * Send · Save & New · Cancel.
 *
 * Mirrors `accounts/new/page.tsx`.
 */

import { Suspense } from 'react';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { QuotationForm } from '../_components/quotation-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';
import { Skeleton } from '@/components/zoruui/skeleton';
import { Button } from '@/components/zoruui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/zoruui/dropdown-menu';
import { ChevronDown, Download, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

function QuotationFormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

async function QuotationFormWrapper() {
  let customFields: WsCustomField[] = [];
  try {
    const fields = await getCustomFieldsFor('quotation');
    if (Array.isArray(fields)) {
      customFields = fields as WsCustomField[];
    }
  } catch (error) {
    console.error('Failed to load custom fields for quotation:', error);
    // Graceful fallback to empty custom fields array
  }

  return <QuotationForm customFields={customFields} />;
}

export default function NewQuotationPage() {
  const actions = (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Download className="h-4 w-4" />
            Import
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Import from HubSpot</DropdownMenuItem>
          <DropdownMenuItem>Import from Salesforce</DropdownMenuItem>
          <DropdownMenuItem>Import from CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <FileText className="h-4 w-4" />
            Templates
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Standard Quote</DropdownMenuItem>
          <DropdownMenuItem>Detailed Proposal</DropdownMenuItem>
          <DropdownMenuItem>Quick Estimate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <EntityDetailShell
      eyebrow="QUOTATION"
      title="New quotation"
      back={{ href: '/dashboard/crm/sales/quotations', label: 'Quotations' }}
      actions={actions}
    >
      <Suspense fallback={<QuotationFormSkeleton />}>
        <QuotationFormWrapper />
      </Suspense>
    </EntityDetailShell>
  );
}
