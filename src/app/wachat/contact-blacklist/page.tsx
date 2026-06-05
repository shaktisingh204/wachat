'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Textarea,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { ShieldBan,
  Plus,
  Trash2,
  Upload } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getBlacklist, addToBlacklist, removeFromBlacklist, bulkAddToBlacklist } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Contact Blacklist — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

export default function ContactBlacklistPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getBlacklist(projectId);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      setNumbers(res.numbers ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    const trimmed = phone.trim();
    if (!trimmed || !projectId) return;
    startMutateTransition(async () => {
      const res = await addToBlacklist(projectId, trimmed);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      setPhone('');
      toast({ title: 'Added', description: `${trimmed} blacklisted.`, tone: 'success' });
      fetchData();
    });
  };

  const handleBulkAdd = () => {
    if (!projectId) return;
    const phones = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (phones.length === 0) return;
    startMutateTransition(async () => {
      const res = await bulkAddToBlacklist(projectId, phones);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      setBulkText('');
      setBulkOpen(false);
      toast({
        title: 'Added',
        description: `${res.count} numbers blacklisted.`,
        tone: 'success',
      });
      fetchData();
    });
  };

  const handleRemove = (id: string, phoneNum: string) => {
    startMutateTransition(async () => {
      const res = await removeFromBlacklist(id);
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      toast({
        title: 'Removed',
        description: `${phoneNum} removed from blacklist.`,
        tone: 'success',
      });
      fetchData();
    });
  };

  const isLoadingInitial = isLoading && numbers.length === 0;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Blacklist' },
      ]}
      title="Contact Blacklist"
      description="Block phone numbers from sending messages to your project."
      actions={<Badge tone="neutral">{numbers.length} blocked</Badge>}
      width="wide"
    >
      {/* Add form */}
      <Card padding="none">
        <CardHeader>
          <CardTitle>Add a number</CardTitle>
        </CardHeader>
        <CardBody>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <Field label="Phone number">
              <Input
                id="bl-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={handleAdd}
              disabled={!phone.trim() || isMutating}
            >
              Add
            </Button>

            <Button
              variant="outline"
              size="sm"
              iconLeft={Upload}
              onClick={() => setBulkOpen(true)}
            >
              Bulk
            </Button>

            <Modal
              open={bulkOpen}
              onClose={() => setBulkOpen(false)}
              title="Bulk add to blacklist"
              description="Paste one phone number per line. All numbers will be blocked from contacting this project."
              footer={
                <>
                  <Button
                    variant="outline"
                    onClick={() => setBulkOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleBulkAdd}
                    loading={isMutating}
                    disabled={!bulkText.trim() || isMutating}
                  >
                    Add all
                  </Button>
                </>
              }
            >
              <Textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="+1234567890&#10;+19876543210&#10;…"
                className="min-h-[160px]"
              />
            </Modal>
          </div>
        </div>
        </CardBody>
      </Card>

      {isLoadingInitial ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={48} className="w-full" />
          ))}
        </div>
      ) : numbers.length > 0 ? (
        <Card padding="none" className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>#</Th>
                <Th>Phone Number</Th>
                <Th align="right">Action</Th>
              </Tr>
            </THead>
            <TBody>
              {numbers.map((item, i) => (
                <Tr key={item._id}>
                  <Td className="tabular-nums [color:var(--st-text-secondary)]">
                    {i + 1}
                  </Td>
                  <Td className="font-mono">
                    {item.phone}
                  </Td>
                  <Td align="right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="danger"
                          size="sm"
                          iconLeft={Trash2}
                          disabled={isMutating}
                        >
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove from blacklist?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {item.phone} will be allowed to message your
                            project again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            intent="danger"
                            onClick={() => handleRemove(item._id, item.phone)}
                          >
                            Remove
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
          icon={ShieldBan}
          title="No numbers blacklisted"
          description="Add phone numbers above to block them from contacting this project."
        />
      )}
    </WachatPage>
  );
}
