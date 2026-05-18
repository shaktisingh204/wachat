'use client';

/**
 * <ItemDetailActions> — top-right action group on the item detail page.
 *
 * Renders 9+ actions: Edit · Adjust stock · Duplicate · Print barcode ·
 * Generate QR · Email · Archive · Delete · Activity. The status pill is a
 * clickable dropdown.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ArrowLeftRight,
  Copy,
  Mail,
  Pencil,
  Power,
  Printer,
  QrCode,
  ShoppingCart,
  Trash2,
  Warehouse,
} from 'lucide-react';

import {
  ZoruButton,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { deleteCrmProduct } from '@/app/actions/crm-products.actions';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

interface ItemDetailActionsProps {
  productId: string;
  productName: string;
  status?: string;
}

export function ItemDetailActions({
  productId,
  productName,
  status,
}: ItemDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status ?? 'active');
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => setCurrentStatus(status ?? 'active'), [status]);

  const moveTo = (next: string) => {
    if (next === currentStatus) return;
    // Soft-archive isn't wired in `saveCrmProduct` yet — surface a toast so
    // the user knows the click was registered but the column needs work.
    setCurrentStatus(next);
    toast({
      title: `Status change to "${next}" queued`,
      description:
        'Persistence lands once `saveCrmProduct` accepts a status column.',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ZoruDropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change status"
          >
            <StatusPill
              label={currentStatus}
              tone={statusToTone(currentStatus)}
            />
          </button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent>
          {STATUS_OPTIONS.map((s) => (
            <ZoruDropdownMenuItem
              key={s.value}
              onSelect={() => moveTo(s.value)}
            >
              {s.label}
            </ZoruDropdownMenuItem>
          ))}
        </ZoruDropdownMenuContent>
      </ZoruDropdownMenu>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/inventory/items/${productId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/inventory/adjustments/new?productId=${productId}`}>
          <Warehouse className="h-3.5 w-3.5" /> Adjust stock
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/inventory/stock-transfers/new?productId=${productId}`}>
          <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer
        </Link>
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => moveTo(currentStatus === 'inactive' ? 'active' : 'inactive')}
      >
        <Power className="h-3.5 w-3.5" />
        {currentStatus === 'inactive' ? 'Mark active' : 'Mark inactive'}
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/inventory/items/new?fromKind=product&fromId=${productId}`}
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/purchases/orders/new?fromKind=product&fromId=${productId}`}
        >
          <ShoppingCart className="h-3.5 w-3.5" /> Add to PO
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/inventory/items/${productId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print barcode
        </a>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/inventory/items/${productId}?qr=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <QrCode className="h-3.5 w-3.5" /> QR
        </a>
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() =>
          toast({
            title: 'Email coming soon',
            description: 'Wire once item-email template lands.',
          })
        }
      >
        <Mail className="h-3.5 w-3.5" /> Email
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </ZoruButton>

      <ZoruButton size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </ZoruButton>

      <ZoruButton size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/inventory/items/${productId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </ZoruButton>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${productName}?`}
        description="Archived items are hidden from default views. Wiring lands when `saveCrmProduct` accepts a status column."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          setCurrentStatus('archived');
          toast({ title: 'Marked archived locally', description: 'Persistence deferred.' });
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${productName}?`}
        description="This permanently removes the item and its stock-adjustment history. Cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteCrmProduct(productId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/inventory/items');
          } else {
            toast({
              title: 'Delete failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />
    </div>
  );
}
