'use client';

/**
 * SabCreator builder shell. Left rail switches between Forms / Pages /
 * Workflows / Roles / Data. Each tab renders its own list + inline
 * create action. Detail editors live at nested routes.
 *
 * Pure 20ui: every primitive comes from `@/components/sabcrm/20ui`. Inputs are
 * wrapped in Field for automatic label + a11y wiring, dialogs use the compound
 * Dialog, and create/publish failures surface through the 20ui toast system.
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

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@/components/sabcrm/20ui';
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
  { key: 'forms', label: 'Forms', icon: <FileText className="size-4" aria-hidden="true" /> },
  { key: 'pages', label: 'Pages', icon: <LayoutGrid className="size-4" aria-hidden="true" /> },
  { key: 'workflows', label: 'Workflows', icon: <Workflow className="size-4" aria-hidden="true" /> },
  { key: 'roles', label: 'Roles', icon: <Shield className="size-4" aria-hidden="true" /> },
  { key: 'data', label: 'Data', icon: <Database className="size-4" aria-hidden="true" /> },
];

/** A Link styled as a 20ui secondary/outline button (Button has no asChild). */
function LinkButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={['u-btn', 'u-btn--outline', 'u-btn--sm', className].filter(Boolean).join(' ')}
    >
      <span className="u-btn__label">{children}</span>
    </Link>
  );
}

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
  const { toast } = useToast();
  const [publishing, startPublish] = useTransition();

  const handlePublish = () => {
    startPublish(async () => {
      try {
        await publishSabcreatorApp(app._id);
        toast.success('App published');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] publish failed', err);
        toast.error('Could not publish the app');
      }
    });
  };

  return (
    <div className="ui20 min-h-screen flex flex-col">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{app.name}</PageTitle>
          <PageDescription>
            App builder, slug{' '}
            <code className="text-[var(--st-text)]">/{app.slug}</code>
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Badge
            tone={app.status === 'published' ? 'success' : 'neutral'}
            kind={app.status === 'published' ? 'solid' : 'outline'}
          >
            {app.status}
          </Badge>
          <LinkButton href={`/dashboard/sabcreator/${app._id}/preview`}>
            Preview
          </LinkButton>
          <Button
            variant="primary"
            onClick={handlePublish}
            loading={publishing}
            iconLeft={Rocket}
          >
            {publishing ? 'Publishing...' : 'Publish'}
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 grid grid-cols-[220px_1fr] gap-6 px-6 pb-10">
        <nav className="space-y-1" aria-label="Builder sections">
          {NAV.map((n) => (
            <Button
              key={n.key}
              variant={tab === n.key ? 'primary' : 'ghost'}
              block
              aria-current={tab === n.key ? 'page' : undefined}
              onClick={() => setTab(n.key)}
              className="justify-start"
            >
              {n.icon}
              {n.label}
            </Button>
          ))}
          <div className="pt-4 border-t border-[var(--st-border)] mt-4">
            <Link
              href="/dashboard/sabcreator"
              className="block px-3 py-2 text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              All apps
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

// Forms ───────────────────────────────────────────────────────────────────────
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
  const { toast } = useToast();

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
        toast.success('Form created');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createForm failed', err);
        toast.error('Could not create the form');
      }
    });
  };

  return (
    <Card padding="md">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--st-text)]">Forms</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)} iconLeft={Plus}>
          New form
        </Button>
      </header>
      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Forms capture user input and write to a linked SabTables table."
        />
      ) : (
        <ul className="divide-y divide-[var(--st-border)]">
          {forms.map((f) => (
            <li key={f._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--st-text)]">{f.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  to {f.submitAction}
                  {f.sabtablesTableId ? `, table ${f.sabtablesTableId.slice(-6)}` : ''}
                </div>
              </div>
              <LinkButton href={`/dashboard/sabcreator/${appId}/builder/forms/${f._id}`}>
                <Settings2 className="size-4" aria-hidden="true" /> Design
              </LinkButton>
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
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="SabTables table id (optional)">
              <Input
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                placeholder="paste a sabtables_tables _id"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={pending}
              disabled={!name.trim()}
            >
              {pending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Pages ─────────────────────────────────────────────────────────────────────
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
  const { toast } = useToast();

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
        toast.success('Page created');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createPage failed', err);
        toast.error('Could not create the page');
      }
    });
  };

  return (
    <Card padding="md">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--st-text)]">Pages</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)} iconLeft={Plus}>
          New page
        </Button>
      </header>
      {pages.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No pages yet"
          description="Compose dashboards, list views, and detail screens for app users."
        />
      ) : (
        <ul className="divide-y divide-[var(--st-border)]">
          {pages.map((p) => (
            <li key={p._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--st-text)]">{p.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  {p.kind}, /{p.slug}
                </div>
              </div>
              <LinkButton href={`/dashboard/sabcreator/${appId}/builder/pages/${p._id}`}>
                <Settings2 className="size-4" aria-hidden="true" /> Design
              </LinkButton>
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
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Kind">
              <Select value={kind} onValueChange={(v) => setKind(v as SabcreatorPageKind)}>
                <SelectTrigger aria-label="Kind">
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
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={pending}
              disabled={!name.trim()}
            >
              {pending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Workflows ─────────────────────────────────────────────────────────────────
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
  const { toast } = useToast();

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
        toast.success('Workflow created');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createWorkflow failed', err);
        toast.error('Could not create the workflow');
      }
    });
  };

  return (
    <Card padding="md">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--st-text)]">Workflows</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)} iconLeft={Plus}>
          New workflow
        </Button>
      </header>
      {workflows.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Hook into form submits, record changes, button clicks, or cron, then fan out via SabFlow."
        />
      ) : (
        <ul className="divide-y divide-[var(--st-border)]">
          {workflows.map((w) => (
            <li key={w._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--st-text)]">{w.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  trigger: {w.trigger.kind}
                  {w.sabflowRefId ? `, sabflow ${w.sabflowRefId.slice(-6)}` : ', inline'}
                </div>
              </div>
              <Badge kind="outline">{w.status}</Badge>
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
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Trigger">
              <Select
                value={triggerKind}
                onValueChange={(v) =>
                  setTriggerKind(v as SabcreatorWorkflowTriggerKind)
                }
              >
                <SelectTrigger aria-label="Trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="form_submit">Form submit</SelectItem>
                  <SelectItem value="record_change">Record change</SelectItem>
                  <SelectItem value="cron">Cron</SelectItem>
                  <SelectItem value="button_click">Button click</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="SabFlow flow id (optional)">
              <Input
                value={sabflowRefId}
                onChange={(e) => setSabflowRefId(e.target.value)}
                placeholder="paste a sabflow flow _id to delegate execution"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={pending}
              disabled={!name.trim()}
            >
              {pending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Roles ─────────────────────────────────────────────────────────────────────
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
  const { toast } = useToast();

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
        toast.success('Role created');
        router.refresh();
      } catch (err) {
        console.error('[sabcreator] createRole failed', err);
        toast.error('Could not create the role');
      }
    });
  };

  return (
    <Card padding="md">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[var(--st-text)]">Roles and row-level security</h2>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)} iconLeft={Plus}>
          New role
        </Button>
      </header>
      {roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No roles yet"
          description="Define who can read, edit, or delete which records, and which forms or pages they may use."
        />
      ) : (
        <ul className="divide-y divide-[var(--st-border)]">
          {roles.map((r) => (
            <li key={r._id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--st-text)]">{r.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  read: {r.recordsCanRead.rule}, edit: {r.recordsCanEdit.rule},
                  delete: {r.recordsCanDelete.rule}
                </div>
              </div>
              <Badge kind="outline">{r.formsCanSubmit?.length ?? 0} forms</Badge>
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
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
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
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={pending}
              disabled={!name.trim()}
            >
              {pending ? 'Creating...' : 'Create'}
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
    <Field label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as typeof value)}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="own">Own records only</SelectItem>
          <SelectItem value="all">All records</SelectItem>
          <SelectItem value="conditional">Conditional (rule below)</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );
}

// Data ──────────────────────────────────────────────────────────────────────
function DataPanel({ app }: { app: SabcreatorAppDoc }) {
  return (
    <Card padding="lg">
      <h2 className="font-semibold mb-2 text-[var(--st-text)]">Data source</h2>
      <p className="text-sm text-[var(--st-text-secondary)] mb-4">
        SabCreator stores app records in SabTables. Each form points at one table; pages
        read from the same base.
      </p>
      {app.sabtablesBaseId ? (
        <div className="text-sm text-[var(--st-text)]">
          Linked SabTables base:{' '}
          <code className="text-[var(--st-text)]">{app.sabtablesBaseId}</code>
        </div>
      ) : (
        <div className="text-sm text-[var(--st-text-secondary)]">
          No SabTables base linked yet. Update the app to link one, forms can still target
          individual tables in the meantime.
        </div>
      )}
      <div className="mt-4">
        <LinkButton href="/dashboard/sabtables">Open SabTables</LinkButton>
      </div>
    </Card>
  );
}
