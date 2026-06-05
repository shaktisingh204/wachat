'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Card,
  Modal,
  EmptyState,
  Field,
  Input,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Ban,
  ShieldOff,
  Plus,
  Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getBlockedContacts, blockContact, unblockContact } from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Blocked Contacts — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

export default function BlockedContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getBlockedContacts(activeProjectId);
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
      else setContacts(res.contacts ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBlock = () => {
    if (!activeProjectId || !phone.trim()) return;
    startTransition(async () => {
      const res = await blockContact(
        activeProjectId,
        phone.trim(),
        reason.trim(),
      );
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
      else {
        toast({ title: 'Blocked', description: `${phone} has been blocked.`, tone: 'success' });
        setPhone('');
        setReason('');
        setOpen(false);
        fetchData();
      }
    });
  };

  const handleUnblock = (id: string) => {
    startTransition(async () => {
      const res = await unblockContact(id);
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
      else {
        toast({ title: 'Unblocked', description: 'Contact unblocked.', tone: 'success' });
        fetchData();
      }
    });
  };

  const isLoadingInitial = isPending && contacts.length === 0;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Blocked' },
      ]}
      title="Blocked Contacts"
      description="Manage contacts blocked from sending messages to this project."
      width="wide"
      actions={
        <Button size="sm" variant="primary" iconLeft={Plus} onClick={() => setOpen(true)}>
          Block contact
        </Button>
      }
    >
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Block a contact"
        description="Block a phone number from sending messages to this project."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleBlock}
              disabled={isPending || !phone.trim()}
            >
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Ban aria-hidden="true" />}
              Block
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Phone number" required>
            <Input
              id="block-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
            />
          </Field>
          <Field label="Reason (optional)">
            <Input
              id="block-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this contact being blocked?"
            />
          </Field>
        </div>
      </Modal>

      {isLoadingInitial ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : contacts.length > 0 ? (
        <Card padding="none" className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Phone</Th>
                <Th>Reason</Th>
                <Th>Blocked Date</Th>
                <Th align="right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {contacts.map((c) => (
                <Tr key={c._id}>
                  <Td>
                    <span className="font-mono text-[13px] text-[var(--st-text)]">
                      {c.phone}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[13px] text-[var(--st-text-secondary)]">
                      {c.reason || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[13px] text-[var(--st-text-secondary)]">
                      {c.blockedAt ? fmtDate(c.blockedAt) : '—'}
                    </span>
                  </Td>
                  <Td align="right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconLeft={ShieldOff}
                          disabled={isPending}
                        >
                          Unblock
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Unblock this contact?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {c.phone} will be allowed to send messages again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            intent="primary"
                            onClick={() => handleUnblock(c._id)}
                          >
                            Unblock
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Ban}
          title="No blocked contacts"
          description="Use the Block contact button above to block a phone number from contacting your project."
        />
      )}
    </WachatPage>
  );
}
