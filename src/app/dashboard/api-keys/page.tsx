'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  TBody,
  Td,
  Th,
  THead,
  Table,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { Check,
  Copy,
  Key,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getApiKeys,
  createApiKey,
  revokeApiKey } from '@/app/actions/wachat-features.actions';

import * as React from 'react';

function maskKey(key: string) {
  if (key.length <= 12) return key;
  return key.slice(0, 8) + '…' + key.slice(-4);
}

export default function ApiKeysPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [keys, setKeys] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getApiKeys(projectId);
      if (res.error) {
        toast.error({ title: 'Error', description: res.error });
        return;
      }
      setKeys(res.keys ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    if (!newName.trim() || !projectId) return;
    startMutateTransition(async () => {
      const res = await createApiKey(projectId, newName.trim());
      if (res.error) {
        toast.error({ title: 'Error', description: res.error });
        return;
      }
      toast.success({ title: 'Key created', description: res.message });
      if (res.key) setNewlyCreatedKey(res.key);
      setNewName('');
      setShowCreate(false);
      fetchData();
    });
  };

  const handleCopy = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success({ title: 'Copied', description: 'API key copied to clipboard.' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = (keyId: string, keyName: string) => {
    if (
      !window.confirm(
        `Revoke API key "${keyName}"? Any services using it will stop working immediately.`,
      )
    )
      return;
    startMutateTransition(async () => {
      const res = await revokeApiKey(keyId);
      if (res.error) {
        toast.error({ title: 'Error', description: res.error });
        return;
      }
      toast.success({ title: 'Revoked', description: 'API key has been revoked.' });
      fetchData();
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" aria-hidden="true" />
        <span className="sr-only">Loading API keys</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-[var(--st-space-7)]">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>API keys</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>API keys</PageTitle>
          <PageDescription>
            Manage API keys for programmatic access to WhatsApp APIs.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button size="sm" iconLeft={Plus} onClick={() => setShowCreate(true)}>
            Create new key
          </Button>
        </PageActions>
      </PageHeader>

      {showCreate && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle>New API key</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex max-w-md items-end gap-3">
              <Field label="Key name" className="flex-1">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Production"
                />
              </Field>
              <Button
                size="sm"
                variant="primary"
                onClick={handleCreate}
                disabled={!newName.trim() || isMutating}
              >
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {newlyCreatedKey && (
        <Alert tone="success" icon={Key}>
          <AlertTitle>New key created</AlertTitle>
          <AlertDescription>
            Copy it now. It will not be shown in full again.
            <code className="mt-1 block break-all font-mono text-xs">{newlyCreatedKey}</code>
            <Button
              size="sm"
              variant="outline"
              iconLeft={Copy}
              className="mt-2"
              onClick={() => {
                handleCopy(newlyCreatedKey, 'new');
                setNewlyCreatedKey(null);
              }}
            >
              Copy key
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Alert tone="warning" icon={ShieldAlert}>
        <AlertDescription>
          Keep your API keys secure. Do not share them in public repositories or client-side code.
        </AlertDescription>
      </Alert>

      {keys.length > 0 ? (
        <Card padding="none" className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Key</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {keys.map((k) => (
                <Tr key={k._id}>
                  <Td className="text-[var(--st-text)]">{k.name}</Td>
                  <Td className="font-mono text-[var(--st-text)]">{maskKey(k.key)}</Td>
                  <Td>
                    <Badge tone={k.isActive ? 'success' : 'danger'}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-[var(--st-text-secondary)]">
                    {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '-'}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton
                        label={copiedId === k._id ? 'Copied' : 'Copy key'}
                        icon={copiedId === k._id ? Check : Copy}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(k.key, k._id)}
                      />
                      {k.isActive && (
                        <IconButton
                          label="Revoke key"
                          icon={Trash2}
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(k._id, k.name || 'Unnamed')}
                          disabled={isMutating}
                        />
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={Key}
          title="No API keys yet"
          description="Create one to get started."
        />
      )}
    </div>
  );
}
