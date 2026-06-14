'use client';

import * as React from 'react';
import {
  Button,
  IconButton,
  Modal,
  Input,
  Field,
  Label,
  Badge,
  Card,
  Textarea,
  SelectField,
  EmptyState,
  Skeleton,
  SearchInput,
  Separator,
  useToast,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import {
  Plus,
  Trash2,
  ChevronRight,
  Edit2,
  Workflow,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  listVoiceIvrs,
  createVoiceIvr,
  updateVoiceIvr,
  deleteVoiceIvr,
  type VoiceIvrNode,
  type VoiceIvrNodeType,
} from '@/app/actions/sabcall.actions';

type IvrRow = {
  _id: string;
  name: string;
  description?: string | null;
  status: 'draft' | 'active' | 'archived';
  rootNode: VoiceIvrNode;
  greetingFileId?: string | null;
};

const NODE_TYPES: VoiceIvrNodeType[] = [
  'menu',
  'playback',
  'forward',
  'voicemail',
  'hangup',
  'conditional',
];

function cloneTree(n: VoiceIvrNode): VoiceIvrNode {
  return JSON.parse(JSON.stringify(n));
}

function NodeEditor({
  node,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  depth,
}: {
  node: VoiceIvrNode;
  onChange: (n: VoiceIvrNode) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  depth: number;
}) {
  const update = <K extends keyof VoiceIvrNode>(key: K, val: VoiceIvrNode[K]) => {
    onChange({ ...node, [key]: val });
  };

  const addChild = (type: VoiceIvrNodeType) => {
    const children = [...(node.children ?? []), { type, children: [] } as VoiceIvrNode];
    onChange({ ...node, children });
  };

  const updateChild = (idx: number, child: VoiceIvrNode) => {
    const children = [...(node.children ?? [])];
    children[idx] = child;
    onChange({ ...node, children });
  };

  const deleteChild = (idx: number) => {
    const children = [...(node.children ?? [])];
    children.splice(idx, 1);
    onChange({ ...node, children });
  };

  const moveChild = (idx: number, dir: -1 | 1) => {
    const children = [...(node.children ?? [])];
    const j = idx + dir;
    if (j < 0 || j >= children.length) return;
    [children[idx], children[j]] = [children[j], children[idx]];
    onChange({ ...node, children });
  };

  return (
    <div
      className="border-l-2 border-[var(--st-border)] pl-3 my-1"
      style={{ marginLeft: depth * 4 }}
    >
      <div className="flex items-start gap-2 mb-1">
        <div className="w-36 shrink-0">
          <SelectField
            value={node.type}
            onChange={(v) => update('type', (v as VoiceIvrNodeType) ?? 'menu')}
            aria-label="Node type"
            options={NODE_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </div>
        {node.type === 'menu' && (
          <Input
            placeholder="Prompt..."
            aria-label="Menu prompt"
            value={(node.prompt as string) ?? ''}
            onChange={(e) => update('prompt', e.target.value)}
            className="flex-1"
          />
        )}
        {node.type === 'forward' && (
          <Input
            placeholder="Forward to (queue id / user id / number)"
            aria-label="Forward target"
            value={(node.to as string) ?? ''}
            onChange={(e) => update('to', e.target.value)}
            className="flex-1"
          />
        )}
        {node.type === 'conditional' && (
          <Input
            placeholder="Condition expression..."
            aria-label="Condition expression"
            value={(node.condition as string) ?? ''}
            onChange={(e) => update('condition', e.target.value)}
            className="flex-1"
          />
        )}
        {node.type === 'playback' && (
          <SabFilePickerButton
            accept="audio"
            onPick={(p) => update('fileId', p.url)}
          >
            {(node.fileId as string) ? 'Change Audio' : 'Pick Audio'}
          </SabFilePickerButton>
        )}
        {onMoveUp && (
          <IconButton
            label="Move node up"
            icon={ArrowUp}
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
          />
        )}
        {onMoveDown && (
          <IconButton
            label="Move node down"
            icon={ArrowDown}
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
          />
        )}
        {onDelete && (
          <IconButton
            label="Delete node"
            icon={Trash2}
            variant="danger"
            size="sm"
            onClick={onDelete}
          />
        )}
      </div>

      {(node.children ?? []).map((c: VoiceIvrNode, i: number) => (
        <NodeEditor
          key={i}
          node={c}
          depth={depth + 1}
          onChange={(nn) => updateChild(i, nn)}
          onDelete={() => deleteChild(i)}
          onMoveUp={i > 0 ? () => moveChild(i, -1) : undefined}
          onMoveDown={
            i < (node.children ?? []).length - 1 ? () => moveChild(i, 1) : undefined
          }
        />
      ))}

      <div className="flex gap-1 mt-1 flex-wrap">
        {NODE_TYPES.map((t) => (
          <Button
            key={t}
            variant="outline"
            size="sm"
            iconLeft={Plus}
            onClick={() => addChild(t)}
            className="sc-press"
          >
            {t}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function VoiceIvrPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<IvrRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  const [editing, setEditing] = React.useState<IvrRow | null>(null);
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<'draft' | 'active' | 'archived'>('draft');
  const [tree, setTree] = React.useState<VoiceIvrNode>({
    type: 'menu',
    prompt: 'Welcome. Press 1 for sales, 2 for support.',
    children: [],
  });
  const [greetingFileId, setGreetingFileId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVoiceIvrs({ q: search });
      if (res.success) setData(res.data as IvrRow[]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setStatus('draft');
    setTree({
      type: 'menu',
      prompt: 'Welcome. Press 1 for sales, 2 for support.',
      children: [],
    });
    setGreetingFileId(null);
    setIsEditorOpen(true);
  };

  const openEdit = (row: IvrRow) => {
    setEditing(row);
    setName(row.name);
    setDescription(row.description ?? '');
    setStatus(row.status);
    setTree(cloneTree(row.rootNode));
    setGreetingFileId(row.greetingFileId ?? null);
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      if (editing) {
        await updateVoiceIvr(editing._id, {
          name,
          description,
          status,
          rootNode: tree,
          greetingFileId: greetingFileId ?? undefined,
        });
      } else {
        await createVoiceIvr({
          name,
          description,
          status,
          rootNode: tree,
          greetingFileId: greetingFileId ?? undefined,
        });
      }
      setIsEditorOpen(false);
      toast.success(editing ? 'IVR updated' : 'IVR created');
      void load();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteVoiceIvr(id);
      toast.success('IVR archived');
      void load();
    } catch (e) {
      toast.error(`Archive failed: ${(e as Error).message}`);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>IVR flows</PageTitle>
          <PageDescription>
            Design call-routing trees: menus, playback, forwards, and voicemail.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
            New IVR
          </Button>
        </PageActions>
      </PageHeader>

      <div className="max-w-sm">
        <Field label="Search">
          <SearchInput value={search} onValueChange={setSearch} placeholder="Search IVR flows" />
        </Field>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card variant="outlined">
          <EmptyState
            icon={Workflow}
            title="No IVR flows yet"
            description="Create your first call-routing tree to greet and direct incoming calls."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
                New IVR
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--st-space-3)] md:grid-cols-2">
          {data.map((ivr) => (
            <Card key={ivr._id} variant="outlined" className="sc-card flex flex-col gap-[var(--st-space-2)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)]"
                    style={{ background: '#7c3aed1a', color: '#7c3aed' }}
                  >
                    <Workflow className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-[var(--st-text)]">{ivr.name}</span>
                </div>
                <Badge tone={ivr.status === 'active' ? 'success' : 'neutral'} className="capitalize">
                  {ivr.status}
                </Badge>
              </div>
              {ivr.description ? (
                <p className="text-sm text-[var(--st-text-secondary)]">{ivr.description}</p>
              ) : null}
              <div className="text-xs text-[var(--st-text-secondary)]">
                Root <span className="font-mono text-[var(--st-text)]">{ivr.rootNode.type}</span> ·{' '}
                <span className="tabular-nums">{ivr.rootNode.children?.length ?? 0}</span> child node(s)
              </div>
              <div className="mt-auto flex gap-2 pt-1">
                <Button size="sm" variant="outline" iconLeft={Edit2} onClick={() => openEdit(ivr)} className="sc-press">
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={Trash2}
                  onClick={() => handleDelete(ivr._id)}
                  className="sc-press"
                >
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editing ? 'Edit IVR' : 'New IVR'}
        description="Name the flow, set a greeting, and build the call-flow tree."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={submitting}
              disabled={submitting || !name.trim()}
              className="sc-press"
            >
              {editing ? 'Save IVR' : 'Create IVR'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Status">
              <SelectField
                value={status}
                onChange={(v) => setStatus((v as typeof status) ?? 'draft')}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="Default greeting">
            <SabFilePickerButton accept="audio" onPick={(p) => setGreetingFileId(p.url)}>
              {greetingFileId ? 'Change greeting' : 'Pick from SabFiles'}
            </SabFilePickerButton>
          </Field>
          <Separator />
          <div>
            <Label className="mb-2 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" aria-hidden="true" /> Call-flow tree
            </Label>
            <NodeEditor node={tree} onChange={setTree} depth={0} />
          </div>
        </div>
      </Modal>
    </main>
  );
}
