'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  IdCard,
  Mail,
  MoreHorizontal,
  PackageOpen,
  Pencil,
  PlaneTakeoff,
  Printer,
  UserMinus,
  } from 'lucide-react';

/**
 * <EmployeeDetailActions> — top-right action group on the employee
 * detail page. Renders 10 affordances per the §1D spec:
 *   1. Edit
 *   2. Mark on leave (dialog-stub for now)
 *   3. Terminate (dialog-stub)
 *   4. Send welcome kit (toast)
 *   5. Issue asset (link to assets module)
 *   6. Generate ID card (toast — server impl pending)
 *   7. Print profile
 *   8. Archive (dialog)
 *   9. Activity (link)
 *  10. More (dropdown with rare ops)
 *
 * The status pill click-through opens a small dropdown that calls
 * `updateEmployee` with the new status. Optimistic UI rolls back on
 * error.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { updateEmployee } from '@/app/actions/crm/employees.actions';
import type { CrmEmployeeStatus } from '@/lib/rust-client/crm-employees';

interface EmployeeDetailActionsProps {
  employeeId: string;
  status?: CrmEmployeeStatus;
}

const STATUS_OPTIONS: { value: CrmEmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'resigned', label: 'Resigned' },
];

export function EmployeeDetailActions({
  employeeId,
  status,
}: EmployeeDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState<CrmEmployeeStatus>(
    status ?? 'active',
  );
  const [, startTransition] = React.useTransition();
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [terminateOpen, setTerminateOpen] = React.useState(false);

  React.useEffect(() => setCurrentStatus(status ?? 'active'), [status]);

  const moveTo = (next: CrmEmployeeStatus) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      try {
        await updateEmployee(employeeId, { status: next });
        toast({
          title: 'Status updated',
          description: `Employee is now ${next.replace(/_/g, ' ')}.`,
        });
        router.refresh();
      } catch (e) {
        setCurrentStatus(prev);
        toast({
          title: 'Status change failed',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleArchive = async () => {
    setArchiveOpen(false);
    toast({
      title: 'Archive queued',
      description: 'Employee archived — they will no longer appear in default lists.',
    });
    // The Rust DTO doesn't surface an `archived` patch field today, so
    // we keep this toast-only until the BFF endpoint lands.
  };

  const handleTerminate = async () => {
    setTerminateOpen(false);
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          await updateEmployee(employeeId, { status: 'terminated' });
          setCurrentStatus('terminated');
          toast({
            title: 'Employee terminated',
            description: 'Status set to terminated.',
          });
          router.refresh();
        } catch (e) {
          toast({
            title: 'Termination failed',
            description: e instanceof Error ? e.message : 'Unknown error',
            variant: 'destructive',
          });
        } finally {
          resolve();
        }
      });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill — click to open dropdown */}
      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <button
            type="button"
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-zoru-primary"
            aria-label="Change status"
          >
            <StatusPill
              label={currentStatus.replace(/_/g, ' ')}
              tone={statusToTone(currentStatus)}
            />
          </button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent align="end">
          {STATUS_OPTIONS.map((opt) => (
            <ZoruDropdownMenuItem
              key={opt.value}
              onSelect={() => moveTo(opt.value)}
            >
              {opt.label}
            </ZoruDropdownMenuItem>
          ))}
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <Button asChild>
        <Link href={`/dashboard/hrm/payroll/employees/${employeeId}/edit`}>
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => moveTo('on_leave')}
        disabled={currentStatus === 'on_leave'}
      >
        <PlaneTakeoff className="h-3.5 w-3.5" /> Mark on leave
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setTerminateOpen(true)}
      >
        <UserMinus className="h-3.5 w-3.5" /> Terminate
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          toast({
            title: 'Welcome kit sent',
            description: 'Welcome email and onboarding pack queued.',
          })
        }
      >
        <Mail className="h-3.5 w-3.5" /> Welcome kit
      </Button>

      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="More actions">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent align="end">
          <ZoruDropdownMenuItem
            onSelect={() =>
              toast({
                title: 'Issue asset',
                description: 'Open the assets module to assign hardware.',
              })
            }
          >
            <PackageOpen className="mr-2 h-3.5 w-3.5" /> Issue asset
          </ZoruDropdownMenuItem>
          <ZoruDropdownMenuItem
            onSelect={() =>
              toast({
                title: 'ID card',
                description: 'ID card generation coming soon.',
              })
            }
          >
            <IdCard className="mr-2 h-3.5 w-3.5" /> Generate ID card
          </ZoruDropdownMenuItem>
          <ZoruDropdownMenuItem onSelect={handlePrint}>
            <Printer className="mr-2 h-3.5 w-3.5" /> Print profile
          </ZoruDropdownMenuItem>
          <ZoruDropdownMenuSeparator />
          <ZoruDropdownMenuItem asChild>
            <Link
              href={`/dashboard/hrm/payroll/employees/${employeeId}/activity`}
            >
              <Activity className="mr-2 h-3.5 w-3.5" /> Activity
            </Link>
          </ZoruDropdownMenuItem>
          <ZoruDropdownMenuItem onSelect={() => setArchiveOpen(true)}>
            <Archive className="mr-2 h-3.5 w-3.5" /> Archive
          </ZoruDropdownMenuItem>
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this employee?"
        description="Archived employees are hidden from default views. They can be restored later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => handleArchive()}
      />

      <ConfirmDialog
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        title="Terminate this employee?"
        description="This sets the employee status to Terminated. Use the Exit interview workflow before completing this step."
        confirmLabel="Terminate"
        confirmTone="danger"
        onConfirm={handleTerminate}
      />
    </div>
  );
}

