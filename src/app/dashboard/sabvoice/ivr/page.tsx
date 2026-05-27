'use client';

import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Badge,
  Card,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/zoruui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { EntityListShell } from '@/components/crm/entity-list-shell';
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
} from '@/app/actions/sabvoice.actions';

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
      className="border-l-2 border-zoru-line pl-3 my-1"
      style={{ marginLeft: depth * 4 }}
    >
      <div className="flex items-start gap-2 mb-1">
        <Select
          value={node.type}
          onValueChange={(v) => update('type', v as VoiceIvrNodeType)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NODE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {node.type === 'menu' && (
          <Input
            placeholder="Prompt..."
            value={(node.prompt as string) ?? ''}
            onChange={(e) => update('prompt', e.target.value)}
            className="flex-1"
          />
        )}
        {node.type === 'forward' && (
          <Input
            placeholder="Forward to (queue id / user id / number)"
            value={(node.to as string) ?? ''}
            onChange={(e) => update('to', e.target.value)}
            className="flex-1"
          />
        )}
        {node.type === 'conditional' && (
          <Input
            placeholder="Condition expression..."
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
          <Button variant="ghost" size="icon-sm" onClick={onMoveUp}>
            <ArrowUp className="h-3 w-3" />
          </Button>
        )}
        {onMoveDown && (
          <Button variant="ghost" size="icon-sm" onClick={onMoveDown}>
            <ArrowDown className="h-3 w-3" />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-zoru-ink"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {(node.children ?? []).map((c, i) => (
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
            onClick={() => addChild(t)}
            className="text-xs h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            {t}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function VoiceIvrPage() {
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
      void load();
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Archive this IVR?')) return;
    await deleteVoiceIvr(id);
    void load();
  };

  return (
    <>
      <EntityListShell
        title="IVR Flows"
        subtitle="Design call routing trees — menus, playback, forwards, voicemail."
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New IVR
          </Button>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search IVRs...' }}
        loading={loading}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map((ivr) => (
            <Card key={ivr._id} className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-zoru-brand" />
                  <span className="font-medium">{ivr.name}</span>
                </div>
                <Badge variant={ivr.status === 'active' ? 'default' : 'outline'}>
                  {ivr.status}
                </Badge>
              </div>
              {ivr.description && (
                <p className="text-sm text-zoru-ink-muted">{ivr.description}</p>
              )}
              <div className="text-xs text-zoru-ink-muted">
                Root: <span className="font-mono">{ivr.rootNode.type}</span>
                {' · '}
                {(ivr.rootNode.children?.length ?? 0)} child node(s)
              </div>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(ivr)}>
                  <Edit2 className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-zoru-ink"
                  onClick={() => handleDelete(ivr._id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </EntityListShell>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit IVR' : 'New IVR'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as never)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Default Greeting (audio)</Label>
              <SabFilePickerButton
                accept="audio"
                onPick={(p) => setGreetingFileId(p.url)}
              >
                {greetingFileId ? 'Change Greeting' : 'Pick from SabFiles'}
              </SabFilePickerButton>
            </div>
            <div className="border-t border-zoru-line pt-3">
              <Label className="mb-2 block flex items-center gap-1">
                <ChevronRight className="h-3 w-3" /> Call-Flow Tree
              </Label>
              <NodeEditor node={tree} onChange={setTree} depth={0} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting || !name.trim()}>
              {submitting ? 'Saving...' : 'Save IVR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
