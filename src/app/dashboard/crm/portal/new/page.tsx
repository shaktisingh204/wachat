'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useZoruToast,
  Checkbox,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardContent
} from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import {
  useActionState,
  useEffect,
  useState,
  useMemo
} from 'react';
import { useFormStatus } from 'react-dom';
import { z } from 'zod';
import { Save, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { savePortalUser } from '@/app/actions/crm-portal.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

function linkedEntityForPortalType(portalType: string): EntityKey {
  if (portalType === 'vendor') return 'vendor';
  if (portalType === 'employee') return 'employee';
  return 'client';
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {pending ? 'Saving…' : 'Save portal user'}
    </Button>
  );
}

const ALL_CAPABILITIES = [
    { key: 'view_invoices', label: 'View invoices', description: 'See open + paid invoices.', section: 'invoices' },
    { key: 'pay_invoices', label: 'Pay invoices', description: 'Initiate online payments.', section: 'invoices' },
    { key: 'raise_tickets', label: 'Raise tickets', description: 'Open support tickets.', section: 'tickets' },
    { key: 'reply_tickets', label: 'Reply on tickets', description: 'Comment on existing tickets.', section: 'tickets' },
    { key: 'view_documents', label: 'View documents', description: 'Read shared documents.', section: 'documents' },
    { key: 'upload_documents', label: 'Upload documents', description: 'Add new files to the portal.', section: 'documents' },
    { key: 'view_orders', label: 'View orders', description: 'See purchase orders and quotes.', section: 'orders' },
    { key: 'approve_orders', label: 'Approve orders', description: 'Approve open POs / quotes.', section: 'orders' },
];

const CAPABILITIES_BY_ROLE: Record<string, string[]> = {
    admin: ALL_CAPABILITIES.map((c) => c.key),
    editor: [
        'view_invoices', 'pay_invoices', 'raise_tickets', 'reply_tickets', 'view_documents', 'upload_documents', 'view_orders',
    ],
    viewer: ['view_invoices', 'view_documents', 'view_orders'],
};

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin', description: 'Full portal access.' },
    { value: 'editor', label: 'Editor', description: 'Read + write on most modules.' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only.' },
];

const initialState = { message: '', error: '' };

export default function NewPortalUserPage() {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction] = useActionState(savePortalUser, initialState);
  const [clientError, setClientError] = useState('');

  const schema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
  });
  
  const handleClientSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const result = schema.safeParse({
        name: formData.get('name'),
        email: formData.get('email')
    });
    if (!result.success) {
        e.preventDefault();
        setClientError(result.error.errors[0].message);
    } else {
        setClientError('');
    }
  };
  const [portalType, setPortalType] = useState<string>('customer');
  const [role, setRole] = useState<string>('viewer');
  const [capabilities, setCapabilities] = useState<string[]>(CAPABILITIES_BY_ROLE['viewer']);

  useEffect(() => {
    if (state.message) {
      toast({
        title: 'Portal user created',
        description: 'Portal user created. Activation email will be sent.',
      });
      router.push('/dashboard/crm/portal');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  function applyRolePreset(next: string): void {
      setRole(next);
      setCapabilities([...CAPABILITIES_BY_ROLE[next]]);
  }

  function toggleCapability(key: string): void {
      setCapabilities((prev) =>
          prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
      );
  }

  const groupedCapabilities = useMemo(() => {
      const groups = new Map<string, typeof ALL_CAPABILITIES>();
      for (const cap of ALL_CAPABILITIES) {
          const list = groups.get(cap.section) ?? [];
          list.push(cap);
          groups.set(cap.section, list);
      }
      return Array.from(groups.entries());
  }, []);

  return (
    <EntityDetailShell
      eyebrow="PORTAL"
      title="New Portal User"
      back={{ href: '/dashboard/crm/portal', label: 'Customer Portal' }}
    >
      <form action={formAction} className="flex flex-col gap-6" onSubmit={handleClientSubmit}>
        <input type="hidden" name="capabilities" value={JSON.stringify(capabilities)} />
        <Card className="p-6">
            <div className="flex flex-col gap-6">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                id="name"
                name="name"
                type="text"
                placeholder="e.g. Rahul Sharma"
                required
                className="max-w-xs"
                />
            </div>

            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">
                Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                id="email"
                name="email"
                type="email"
                placeholder="e.g. rahul@example.com"
                required
                className="max-w-xs"
                />
            </div>

            {/* Portal Type */}
            <div className="flex flex-col gap-1.5">
                <Label>Portal Type</Label>
                <EnumFormField
                enumName="portalType"
                name="portalType"
                initialId={portalType}
                onChange={(v) => setPortalType(v ?? 'customer')}
                />
            </div>

            {/* Linked Entity */}
            <div className="flex flex-col gap-1.5">
                <Label>Linked {portalType === 'vendor' ? 'Vendor' : portalType === 'employee' ? 'Employee' : 'Customer'}</Label>
                <EntityFormField
                entity={linkedEntityForPortalType(portalType)}
                name="linkedEntityId"
                placeholder={`Select ${portalType === 'vendor' ? 'vendor' : portalType === 'employee' ? 'employee' : 'customer'}…`}
                />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Any additional details about this portal user…"
                className="max-w-lg"
                />
            </div>
            </div>
        </Card>

        <Card>
            <ZoruCardHeader>
                <ZoruCardTitle>Role & Access</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-3">
                        {ROLE_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => applyRolePreset(opt.value)}
                                className={`rounded-lg border p-3 text-left transition ${
                                    role === opt.value
                                        ? 'border-zoru-primary bg-zoru-primary/5'
                                        : 'border-zoru-line bg-zoru-bg hover:bg-zoru-surface-2'
                                }`}
                            >
                                <div className="text-[13px] font-medium text-zoru-ink">
                                    {opt.label}
                                </div>
                                <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                    {opt.description}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="rounded-lg border border-zoru-line bg-zoru-bg p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
                            Capabilities
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {groupedCapabilities.map(([section, caps]) => (
                                <div key={section} className="space-y-1.5">
                                    <div className="text-[11px] font-medium capitalize text-zoru-ink-muted">
                                        {section}
                                    </div>
                                    {caps.map((cap) => {
                                        const checked = capabilities.includes(cap.key);
                                        return (
                                            <label
                                                key={cap.key}
                                                className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-zoru-surface-2"
                                            >
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() =>
                                                        toggleCapability(cap.key)
                                                    }
                                                    aria-label={cap.label}
                                                />
                                                <div className="text-[12.5px]">
                                                    <div className="text-zoru-ink">
                                                        {cap.label}
                                                    </div>
                                                    <div className="text-[11px] text-zoru-ink-muted">
                                                        {cap.description}
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ZoruCardContent>
        </Card>

        {clientError && (
            <p className="text-[13px] text-red-500">{clientError}</p>
        )}
        {state.error && (
            <p className="text-[13px] text-red-500">{state.error}</p>
        )}

        <div className="flex items-center gap-3">
            <SubmitButton />
            <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/crm/portal">Cancel</Link>
            </Button>
        </div>
      </form>
    </EntityDetailShell>
  );
}
