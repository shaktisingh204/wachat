'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Label,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Spinner,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  CircleAlert,
  Edit,
  Loader,
  PlusCircle,
  Save,
  Search,
  Star,
  Trash2,
} from 'lucide-react';

import { useProject } from '@/context/project-context';

import {
  deleteCannedMessage,
  getCannedMessages,
  getCannedSettings,
  saveCannedMessage,
  saveCannedSettings,
} from '@/app/actions/wachat-canned-messages.actions';
import type {
  CannedMessageDoc,
  CannedMessageType,
} from '@/lib/rust-client/wachat-canned-messages';

import WachatPage from '@/app/wachat/_components/wachat-page';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

const BREADCRUMB = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Canned messages' },
];

const RESERVED_SHORTCUTS = [
  'cmd + c', 'cmd + v', 'cmd + x', 'cmd + z', 'cmd + y', 'cmd + a', 'cmd + f', 'cmd + p', 'cmd + s', 'cmd + r', 'cmd + t', 'cmd + w', 'cmd + n',
  'ctrl + c', 'ctrl + v', 'ctrl + x', 'ctrl + z', 'ctrl + y', 'ctrl + a', 'ctrl + f', 'ctrl + p', 'ctrl + s', 'ctrl + r', 'ctrl + t', 'ctrl + w', 'ctrl + n',
  'alt + f4', 'alt + tab', 'cmd + tab',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'cmd + shift + t', 'cmd + shift + w', 'cmd + shift + n',
  'ctrl + shift + t', 'ctrl + shift + w', 'ctrl + shift + n',
  'cmd + arrowleft', 'cmd + arrowright', 'alt + arrowleft', 'alt + arrowright',
];

const MESSAGE_TYPES: { value: CannedMessageType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Document' },
];

// ===========================================================================
//  General Settings — now backed by the Rust crate (was localStorage-only).
// ===========================================================================

function GeneralCannedSettings({ projectId }: { projectId: string }) {
  const { toast } = useToast();

  const [syncProjects, setSyncProjects] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [isReserved, setIsReserved] = useState(false);

  const [isLoading, startLoad] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  const checkCollision = useCallback((shortcut: string) => {
    setIsReserved(Boolean(shortcut) && RESERVED_SHORTCUTS.includes(shortcut.toLowerCase()));
  }, []);

  const load = useCallback(() => {
    startLoad(async () => {
      const res = await getCannedSettings(projectId);
      if (res.error) {
        setLoadError(res.error);
        return;
      }
      setLoadError(null);
      const sync = res.syncAcrossProjects ?? false;
      const trg = res.keyboardTrigger ?? 'Cmd + /';
      setSyncProjects(sync);
      setTrigger(trg);
      checkCollision(trg);
    });
  }, [projectId, checkCollision]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    (nextSync: boolean, nextTrigger: string) => {
      startSave(async () => {
        const res = await saveCannedSettings(projectId, nextSync, nextTrigger || null);
        if (!res.success) {
          toast({ title: 'Could not save settings', description: res.error, tone: 'danger' });
        }
      });
    },
    [projectId, toast],
  );

  const handleSyncChange = (checked: boolean) => {
    setSyncProjects(checked);
    persist(checked, trigger);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      setTrigger('');
      checkCollision('');
      persist(syncProjects, '');
      return;
    }

    if (['Control', 'Meta', 'Alt', 'Shift', 'CapsLock', 'Tab'].includes(e.key)) {
      return;
    }

    const keys = [];
    if (e.metaKey) keys.push('Cmd');
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');

    const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    keys.push(keyName);

    const shortcut = keys.join(' + ');
    setTrigger(shortcut);
    checkCollision(shortcut);
    persist(syncProjects, shortcut);
  };

  if (isLoading) return <Skeleton className="h-[250px] w-full mb-6" />;

  return (
    <Card className="mb-2">
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>Configure global preferences for canned messages.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-6">
        {loadError && (
          <Alert tone="danger" title="Couldn't load settings">
            {loadError}
          </Alert>
        )}

        {/* Sync Feature */}
        <div className="flex items-center justify-between space-x-4">
          <Field
            id="sync-projects"
            label="Sync across sub-projects"
            help="Automatically share canned messages with all other active sub-projects in your account."
            className="flex-1"
          >
            {null}
          </Field>
          <Switch
            id="sync-projects"
            checked={syncProjects}
            onCheckedChange={handleSyncChange}
            disabled={isSaving}
            aria-label="Sync across sub-projects"
          />
        </div>

        {/* Keyboard Trigger Feature */}
        <div className="flex flex-col space-y-3">
          <div className="max-w-md">
            <Field
              id="trigger-shortcut"
              label="Keyboard Trigger Shortcut"
              help="Focus the input below and press the key combination you want to use for opening the canned messages menu. Use Backspace to clear."
            >
              <Input
                placeholder="e.g. Cmd + /"
                value={trigger}
                onKeyDown={handleKeyDown}
                readOnly
                className="font-mono cursor-pointer"
              />
            </Field>
          </div>

          {isReserved && (
            <Alert tone="danger" title="Shortcut Collision Detected" className="max-w-md mt-2">
              The selected shortcut ({trigger}) conflicts with a native browser or OS shortcut.
              Please choose a different combination to avoid issues.
            </Alert>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ===========================================================================
//  Create / Edit dialog — 20ui Modal backed by saveCannedMessage.
// ===========================================================================

interface CannedFormModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  existing: CannedMessageDoc | null;
  onSaved: () => void;
}

function CannedFormModal({ open, onClose, projectId, existing, onSaved }: CannedFormModalProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [messageType, setMessageType] = useState<CannedMessageType>(existing?.type ?? 'text');
  const [isFavourite, setIsFavourite] = useState<boolean>(existing?.isFavourite ?? false);

  useEffect(() => {
    if (open) {
      setMessageType(existing?.type ?? 'text');
      setIsFavourite(existing?.isFavourite ?? false);
    } else {
      formRef.current?.reset();
    }
  }, [open, existing]);

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveCannedMessage(null, formData);
      if (result.error) {
        toast({ title: 'Error', description: result.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Success', description: result.message, tone: 'success' });
      onSaved();
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit canned message' : 'Create canned message'}
      description="Save a message for quick use in live chat conversations."
    >
      <form action={submit} ref={formRef} id="canned-form">
        <input type="hidden" name="projectId" value={projectId} />
        {existing && <input type="hidden" name="_id" value={existing._id} />}
        {/* Mirror the select value so the form posts the chosen type. */}
        <input type="hidden" name="type" value={messageType} />
        {/* The 20ui Switch is a button (no native input), so post the favourite
            flag explicitly as "on" / "" to match the server-action contract. */}
        <input type="hidden" name="isFavourite" value={isFavourite ? 'on' : ''} />

        <div className="flex flex-col gap-5">
          {/* Name */}
          <Field label="Name" required help="A unique name to identify this message.">
            <Input
              name="name"
              placeholder="e.g., Welcome Message"
              defaultValue={existing?.name}
              required
            />
          </Field>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="canned-type">Type</Label>
            <Select
              value={messageType}
              onValueChange={(val) => setMessageType(val as CannedMessageType)}
            >
              <SelectTrigger id="canned-type">
                <SelectValue placeholder="Select message type" />
              </SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type-conditional fields */}
          {messageType === 'text' ? (
            <Field label="Content" required>
              <Textarea
                name="text"
                placeholder="Enter your message…"
                className="min-h-32"
                defaultValue={existing?.content?.text}
                required
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Media URL" required>
                <Input
                  name="mediaUrl"
                  placeholder="https://example.com/image.png"
                  defaultValue={existing?.content?.mediaUrl}
                  required
                />
              </Field>
              <Field label="Caption" help="Optional caption for your media.">
                <Textarea
                  name="caption"
                  placeholder="A caption for your media…"
                  defaultValue={existing?.content?.caption}
                />
              </Field>
              {messageType === 'document' && (
                <Field label="File name" help="Optional file name for the document.">
                  <Input
                    name="fileName"
                    placeholder="e.g., product_catalog.pdf"
                    defaultValue={existing?.content?.fileName}
                  />
                </Field>
              )}
            </div>
          )}

          {/* Favourite toggle */}
          <div className="flex items-center justify-between rounded-[12px] border border-zoru-line bg-zoru-surface-2 px-4 py-3">
            <div>
              <Label htmlFor="isFavourite">Mark as favourite</Label>
              <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
                Pins this message to the top of the canned list.
              </div>
            </div>
            <Switch
              id="isFavourite"
              checked={isFavourite}
              onCheckedChange={setIsFavourite}
              aria-label="Mark as favourite"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {isPending ? 'Saving…' : 'Save message'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ===========================================================================
//  Canned messages list — 20ui table backed by getCannedMessages.
// ===========================================================================

function CannedMessagesList({ projectId }: { projectId: string }) {
  const { toast } = useToast();

  const [messages, setMessages] = useState<CannedMessageDoc[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<CannedMessageDoc | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CannedMessageDoc | null>(null);

  const fetchData = useCallback(() => {
    startLoad(async () => {
      const res = await getCannedMessages(projectId);
      if (res.error) {
        setLoadError(res.error);
        setMessages([]);
        return;
      }
      setLoadError(null);
      setMessages(res.messages ?? []);
    });
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.name.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDelete(async () => {
      const result = await deleteCannedMessage(id);
      if (result.success) {
        toast({ title: 'Success', description: 'Canned message deleted.', tone: 'success' });
        setPendingDelete(null);
        fetchData();
      } else {
        toast({ title: 'Error', description: result.error, tone: 'danger' });
      }
    });
  };

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (msg: CannedMessageDoc) => {
    setEditing(msg);
    setIsFormOpen(true);
  };

  const onSaved = () => {
    setIsFormOpen(false);
    setEditing(null);
    fetchData();
  };

  return (
    <>
      <CannedFormModal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        projectId={projectId}
        existing={editing}
        onSaved={onSaved}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete canned message?"
        description={
          pendingDelete
            ? `This will permanently delete the "${pendingDelete.name}" canned message.`
            : undefined
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting && <Spinner className="mr-2 h-4 w-4" />}
              Delete
            </Button>
          </div>
        }
      >
        {null}
      </Modal>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Your Canned Messages</CardTitle>
              <CardDescription>
                A list of all saved messages for this project. Use them in Live Chat.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zoru-ink-muted" />
                <Input
                  placeholder="Search by name…"
                  className="pl-8 w-full sm:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button onClick={openCreate}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {loadError ? (
            <Alert tone="danger" title="Couldn't load canned messages">
              {loadError}
            </Alert>
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title={searchQuery ? 'No matching messages' : 'No canned messages yet'}
              description={
                searchQuery
                  ? 'Try a different search term.'
                  : 'Create your first pre-written snippet so agents can reply instantly.'
              }
              action={
                searchQuery ? undefined : (
                  <Button onClick={openCreate}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create New
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-zoru-line">
              <Table hover>
                <THead>
                  <Tr>
                    <Th className="w-12" />
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Content</Th>
                    <Th>Created By</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((msg) => (
                    <Tr key={msg._id}>
                      <Td>
                        {msg.isFavourite && (
                          <Star className="h-4 w-4 text-zoru-warning-ink fill-current" />
                        )}
                      </Td>
                      <Td className="font-medium">{msg.name}</Td>
                      <Td>
                        <Badge tone="neutral">
                          <span className="capitalize">{msg.type}</span>
                        </Badge>
                      </Td>
                      <Td className="text-zoru-ink-muted max-w-xs truncate">
                        {msg.content?.text || msg.content?.mediaUrl}
                      </Td>
                      <Td className="text-zoru-ink-muted">{msg.createdBy}</Td>
                      <Td className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${msg.name}`}
                          onClick={() => openEdit(msg)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${msg.name}`}
                          onClick={() => setPendingDelete(msg)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

// ===========================================================================
//  Page
// ===========================================================================

export default function CannedMessagesPage() {
  const router = useRouter();
  const { activeProject, isLoadingProject } = useProject();

  if (isLoadingProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <Skeleton className="h-[420px] w-full" />
      </WachatPage>
    );
  }

  if (!activeProject) {
    return (
      <WachatPage breadcrumb={BREADCRUMB} width="narrow">
        <EmptyState
          icon={CircleAlert}
          title="Select a project first"
          description="Pick a project from the WaChat home page to manage canned messages."
          action={<Button onClick={() => router.push('/wachat')}>Choose a project</Button>}
        />
      </WachatPage>
    );
  }

  const projectId = activeProject._id.toString();

  return (
    <WachatPage
      breadcrumb={BREADCRUMB}
      width="narrow"
      title="Canned messages"
      description="Pre-written message snippets your agents can send instantly."
    >
      <GeneralCannedSettings projectId={projectId} />
      <CannedMessagesList projectId={projectId} />
    </WachatPage>
  );
}
