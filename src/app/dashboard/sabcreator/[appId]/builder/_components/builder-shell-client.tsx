'use client';

/**
 * SabCreator builder shell. Left rail switches between Forms / Pages /
 * Workflows / Roles / Data. Each tab renders its own list + inline
 * create action. Detail editors live at nested routes.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Database,
  FileText,
  LayoutGrid,
  Plus,
  Rocket,
  Settings2,
  Shield,
  Workflow,
} from 'lucide-react';

import { Badge, Button, Card, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, EmptyState, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, PageActions, PageDescription, PageTitle } from '@/components/sabcrm/20ui/compat';
import {
  createSabcreatorForm,
  createSabcreatorPage,
  createSabcreatorRole,
  createSabcreatorWorkflow,
  publishSabcreatorApp,
} from '@/app/actions/sabcreator.actions';
import type { SabcreatorAppDoc } from '@/lib/rust-client/sabcreator-apps';
import type { SabcreatorFormDoc } from '@/lib/rust-client/sabcreator-forms';
import type {
  SabcreatorPageDoc,
  SabcreatorPageKind,
} from '@/lib/rust-client/sabcreator-pages';
import type {
  SabcreatorWorkflowDoc,
  SabcreatorWorkflowTriggerKind,
} from '@/lib/rust-client/sabcreator-workflows';
import type { SabcreatorRoleDoc } from '@/lib/rust-client/sabcreator-roles';

type Tab = 'forms' | 'pages' | 'workflows' | 'roles' | 'data';

interface Props {
  app: SabcreatorAppDoc;
  initialForms: SabcreatorFormDoc[];
  initialPages: SabcreatorPageDoc[];
  initialWorkflows: SabcreatorWorkflowDoc[];
  initialRoles: SabcreatorRoleDoc[];
}

const NAV: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  { key: 'forms', label: 'Forms', icon: <FileText className="size-4" /> },
  { key: 'pages', label: 'Pages', icon: <LayoutGrid className="size-4" /> },
  { key: 'workflows', label: 'Workflows', icon: <Workflow className="size-4" /> },
  { key: 'roles', label: 'Roles', icon: <Shield className="size-4" /> },
  { key: 'data', label: 'Data', icon: <Database className="size-4" /> },
];

export function BuilderShellClient({
  app,
  initialForms,
  initialPages,
  initialWorkflows,
  initialRoles,
}: Props) {
  const [tab, setTab] = useState<Tab>('forms');
  const [forms, setForms] = useState(initialForms);
  const [pages, setPages] = useState(initialPages);
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [roles, setRoles] = useState(initialRoles);
  const router = useRouter();
  const [publishing, startPublish] = useTransition();

  const handlePublish = () => {
    startPublish(async () => {
      try {
        await publishSabcreatorApp(app._id);
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] publish failed', err);
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader>
        <div>
          <PageTitle>{app.name}</PageTitle>
          <PageDescription>
            App builder · slug <code>/{app.slug}</code>
          </PageDescription>
        </div>
        <PageActions>
          <Badge variant={app.status === 'published' ? 'default' : 'outline'}>
            {app.status}
          </Badge>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sabcreator/${app._id}/preview`}>Preview</Link>
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            <Rocket className="size-4" />
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-[220px_1fr] gap-6 px-6 pb-10">
        <nav className="space-y-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setTab(n.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                tab === n.key
                  ? 'bg-[var(--st-text)]/10 text-[var(--st-text)] font-medium'
                  : 'text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]'
              }`}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
          <div className="pt-4 border-t mt-4">
            <Link
              href="/dashboard/sabcreator"
              className="block px-3 py-2 text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              ← All apps
            </Link>
          </div>
        </nav>

        <main className="space-y-4">
          {tab === 'forms' && (
            <FormsPanel
              appId={app._id}
              forms={forms}
              onCreate={(doc) => setForms((p) => [doc, ...p])}
            />
          )}
          {tab === 'pages' && (
            <PagesPanel
              appId={app._id}
              pages={pages}
              onCreate={(doc) => setPages((p) => [doc, ...p])}
            />
          )}
          {tab === 'workflows' && (
            <WorkflowsPanel
              appId={app._id}
              workflows={workflows}
              onCreate={(doc) => setWorkflows((p) => [doc, ...p])}
            />
          )}
          {tab === 'roles' && (
            <RolesPanel
              appId={app._id}
              roles={roles}
              onCreate={(doc) => setRoles((p) => [doc, ...p])}
            />
          )}
          {tab === 'data' && <DataPanel app={app} />}
        </main>
      </div>
    </div>
  );
}

// ── Forms ────────────────────────────────────────────────────────────────────
function FormsPanel({
  appId,
  forms,
  onCreate,
}: {
  appId: string;
  forms: SabcreatorFormDoc[];
  onCreate: (d: SabcreatorFormDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [tableId, setTableId] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorForm({
          appId,
          name: name.trim(),
          sabtablesTableId: tableId.trim() || undefined,
          fieldsJson: [],
          submitAction: 'createRecord',
        });
        onCreate(res.entity);
        setName('');
        setTableId('');
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createForm failed', err);
      }
    });
  };

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Forms</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New form
        </Button>
      </header>
      {forms.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No forms yet"
          description="Forms capture user input and write to a linked SabTables table."
        />
      ) : (
        <ul className="divide-y">
          {forms.map((f) => (
            <li key={f._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  → {f.submitAction}
                  {f.sabtablesTableId ? ` · table ${f.sabtablesTableId.slice(-6)}` : ''}
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/dashboard/sabcreator/${appId}/builder/forms/${f._id}`}
                >
                  <Settings2 className="size-4" /> Design
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New form</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="form-name">Name</Label>
              <Input
                id="form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-table">SabTables table id (optional)</Label>
              <Input
                id="form-table"
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                placeholder="paste a sabtables_tables _id"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────
function PagesPanel({
  appId,
  pages,
  onCreate,
}: {
  appId: string;
  pages: SabcreatorPageDoc[];
  onCreate: (d: SabcreatorPageDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SabcreatorPageKind>('dashboard');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorPage({
          appId,
          name: name.trim(),
          kind,
          configJson: { widgets: [] },
        });
        onCreate(res.entity);
        setName('');
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createPage failed', err);
      }
    });
  };

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Pages</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New page
        </Button>
      </header>
      {pages.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="size-6" />}
          title="No pages yet"
          description="Compose dashboards, list views, and detail screens for app users."
        />
      ) : (
        <ul className="divide-y">
          {pages.map((p) => (
            <li key={p._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  {p.kind} · /{p.slug}
                </div>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/dashboard/sabcreator/${appId}/builder/pages/${p._id}`}
                >
                  <Settings2 className="size-4" /> Design
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="page-name">Name</Label>
              <Input
                id="page-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as SabcreatorPageKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="list">List view</SelectItem>
                  <SelectItem value="detail">Detail</SelectItem>
                  <SelectItem value="form">Form</SelectItem>
                  <SelectItem value="chart">Chart</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Workflows ────────────────────────────────────────────────────────────────
function WorkflowsPanel({
  appId,
  workflows,
  onCreate,
}: {
  appId: string;
  workflows: SabcreatorWorkflowDoc[];
  onCreate: (d: SabcreatorWorkflowDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [triggerKind, setTriggerKind] =
    useState<SabcreatorWorkflowTriggerKind>('form_submit');
  const [sabflowRefId, setSabflowRefId] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorWorkflow({
          appId,
          name: name.trim(),
          trigger: { kind: triggerKind, config: {} },
          sabflowRefId: sabflowRefId.trim() || undefined,
        });
        onCreate(res.entity);
        setName('');
        setSabflowRefId('');
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createWorkflow failed', err);
      }
    });
  };

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Workflows</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New workflow
        </Button>
      </header>
      {workflows.length === 0 ? (
        <EmptyState
          icon={<Workflow className="size-6" />}
          title="No workflows yet"
          description="Hook into form submits, record changes, button clicks, or cron — fan out via SabFlow."
        />
      ) : (
        <ul className="divide-y">
          {workflows.map((w) => (
            <li key={w._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  trigger: {w.trigger.kind}
                  {w.sabflowRefId ? ` · sabflow ${w.sabflowRefId.slice(-6)}` : ' · inline'}
                </div>
              </div>
              <Badge variant="outline">{w.status}</Badge>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={triggerKind}
                onValueChange={(v) =>
                  setTriggerKind(v as SabcreatorWorkflowTriggerKind)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="form_submit">Form submit</SelectItem>
                  <SelectItem value="record_change">Record change</SelectItem>
                  <SelectItem value="cron">Cron</SelectItem>
                  <SelectItem value="button_click">Button click</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-flow">SabFlow flow id (optional)</Label>
              <Input
                id="wf-flow"
                value={sabflowRefId}
                onChange={(e) => setSabflowRefId(e.target.value)}
                placeholder="paste a sabflow flow _id to delegate execution"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Roles ────────────────────────────────────────────────────────────────────
function RolesPanel({
  appId,
  roles,
  onCreate,
}: {
  appId: string;
  roles: SabcreatorRoleDoc[];
  onCreate: (d: SabcreatorRoleDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [readRule, setReadRule] = useState<'all' | 'own' | 'conditional'>('own');
  const [editRule, setEditRule] = useState<'all' | 'own' | 'conditional'>('own');
  const [deleteRule, setDeleteRule] = useState<'all' | 'own' | 'conditional'>('own');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const res = await createSabcreatorRole({
          appId,
          name: name.trim(),
          recordsCanRead: { rule: readRule },
          recordsCanEdit: { rule: editRule },
          recordsCanDelete: { rule: deleteRule },
        });
        onCreate(res.entity);
        setName('');
        setOpen(false);
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createRole failed', err);
      }
    });
  };

  return (
    <Card className="p-4">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Roles & row-level security</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New role
        </Button>
      </header>
      {roles.length === 0 ? (
        <EmptyState
          icon={<Shield className="size-6" />}
          title="No roles yet"
          description="Define who can read, edit, or delete which records — and which forms/pages they may use."
        />
      ) : (
        <ul className="divide-y">
          {roles.map((r) => (
            <li key={r._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  read: {r.recordsCanRead.rule} · edit: {r.recordsCanEdit.rule} ·
                  delete: {r.recordsCanDelete.rule}
                </div>
              </div>
              <Badge variant="outline">{r.formsCanSubmit?.length ?? 0} forms</Badge>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <RoleRuleRow label="Records can read" value={readRule} onChange={setReadRule} />
            <RoleRuleRow label="Records can edit" value={editRule} onChange={setEditRule} />
            <RoleRuleRow
              label="Records can delete"
              value={deleteRule}
              onChange={setDeleteRule}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={pending || !name.trim()}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RoleRuleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 'all' | 'own' | 'conditional';
  onChange: (v: 'all' | 'own' | 'conditional') => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as typeof value)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="own">Own records only</SelectItem>
          <SelectItem value="all">All records</SelectItem>
          <SelectItem value="conditional">Conditional (rule below)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────────────────
function DataPanel({ app }: { app: SabcreatorAppDoc }) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold mb-2">Data source</h2>
      <p className="text-sm text-[var(--st-text-secondary)] mb-4">
        SabCreator stores app records in SabTables. Each form points at one table; pages
        read from the same base.
      </p>
      {app.sabtablesBaseId ? (
        <div className="text-sm">
          Linked SabTables base: <code>{app.sabtablesBaseId}</code>
        </div>
      ) : (
        <div className="text-sm text-[var(--st-text-secondary)]">
          No SabTables base linked yet. Update the app to link one — forms can still target
          individual tables in the meantime.
        </div>
      )}
      <Button asChild variant="outline" className="mt-4">
        <Link href="/dashboard/sabtables">Open SabTables</Link>
      </Button>
    </Card>
  );
}
