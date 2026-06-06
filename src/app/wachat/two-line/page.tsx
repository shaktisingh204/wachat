'use client';

import {
  Button,
  IconButton,
  Card,
  Modal,
  useToast,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  SelectField,
  Badge,
  EmptyState,
  Alert,
  Spinner,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { useState, useEffect, useCallback, useTransition } from 'react';
import { Plus, Edit2, Trash2, Phone, Bot, User } from 'lucide-react';

import {
  listNumberRoutingBindings,
  createNumberRoutingBinding,
  updateNumberRoutingBinding,
  deleteNumberRoutingBinding,
  type RoutingTeamOption,
} from '@/app/actions/wachat-number-routing.actions';
import type { NumberRoutingBinding } from '@/lib/rust-client/wachat-number-routing';

type RouteType = 'bot' | 'agent';

interface FormState {
  phoneNumberId: string;
  label: string;
  teamId: string;
  defaultRoute: RouteType;
}

const ROUTE_OPTIONS = [
  { value: 'bot', label: 'AI Bot' },
  { value: 'agent', label: 'Human Agent' },
];

const EMPTY_FORM: FormState = {
  phoneNumberId: '',
  label: '',
  teamId: '',
  defaultRoute: 'bot',
};

const CRUMBS = [
  { label: 'SabNode', href: '/dashboard' },
  { label: 'WaChat', href: '/wachat' },
  { label: 'Numbers & Routing' },
];

export default function MultiNumberManagementPage() {
  const { toast } = useToast();
  const { activeProject } = useProject();

  const [bindings, setBindings] = useState<NumberRoutingBinding[]>([]);
  const [teams, setTeams] = useState<RoutingTeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSaving, startSaving] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog + form states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  // Phone numbers come from the active project (WABA numbers linked there).
  const phoneNumbers = activeProject?.phoneNumbers ?? [];
  const phoneOptions = phoneNumbers.map((p) => ({
    value: p.id,
    label: p.verified_name
      ? `${p.display_phone_number} — ${p.verified_name}`
      : p.display_phone_number,
  }));
  const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }));

  const phoneLabel = useCallback(
    (phoneNumberId: string): string => {
      const phone = phoneNumbers.find((p) => p.id === phoneNumberId);
      return phone?.display_phone_number || phoneNumberId;
    },
    [phoneNumbers],
  );

  const teamName = useCallback(
    (teamId: string | null): string | null => {
      if (!teamId) return null;
      return teams.find((t) => t.id === teamId)?.name ?? null;
    },
    [teams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await listNumberRoutingBindings();
    if (res.error) {
      setLoadError(res.error);
      setBindings([]);
      setTeams([]);
    } else {
      setBindings(res.bindings);
      setTeams(res.teams);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenAdd = () => {
    setFormData({
      ...EMPTY_FORM,
      phoneNumberId: phoneNumbers[0]?.id ?? '',
      defaultRoute: 'bot',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (binding: NumberRoutingBinding) => {
    setEditingId(binding._id);
    setFormData({
      phoneNumberId: binding.phoneNumberId,
      label: binding.label,
      teamId: binding.teamId ?? '',
      defaultRoute: binding.defaultRoute === 'agent' ? 'agent' : 'bot',
    });
    setIsEditOpen(true);
  };

  const handleSaveAdd = () => {
    if (!formData.phoneNumberId || !formData.label.trim()) {
      toast({
        title: 'Missing details',
        description: 'Pick a phone number and enter a label.',
        tone: 'danger',
      });
      return;
    }
    startSaving(async () => {
      const res = await createNumberRoutingBinding({
        label: formData.label,
        phoneNumberId: formData.phoneNumberId,
        teamId: formData.teamId || null,
        defaultRoute: formData.defaultRoute,
      });
      if (!res.success) {
        toast({
          title: 'Could not add binding',
          description: res.error || 'Unexpected error.',
          tone: 'danger',
        });
        return;
      }
      setIsAddOpen(false);
      toast({
        title: 'Binding added',
        description: `${phoneLabel(formData.phoneNumberId)} is now routed.`,
        tone: 'success',
      });
      await load();
    });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    if (!formData.phoneNumberId || !formData.label.trim()) {
      toast({
        title: 'Missing details',
        description: 'Pick a phone number and enter a label.',
        tone: 'danger',
      });
      return;
    }
    startSaving(async () => {
      const res = await updateNumberRoutingBinding(editingId, {
        label: formData.label,
        phoneNumberId: formData.phoneNumberId,
        teamId: formData.teamId || null,
        defaultRoute: formData.defaultRoute,
      });
      if (!res.success) {
        toast({
          title: 'Could not save changes',
          description: res.error || 'Unexpected error.',
          tone: 'danger',
        });
        return;
      }
      setIsEditOpen(false);
      toast({
        title: 'Binding updated',
        description: 'Your changes have been saved.',
        tone: 'success',
      });
      await load();
    });
  };

  const handleDelete = (binding: NumberRoutingBinding) => {
    setDeletingId(binding._id);
    startSaving(async () => {
      const res = await deleteNumberRoutingBinding(binding._id);
      setDeletingId(null);
      if (!res.success) {
        toast({
          title: 'Could not delete',
          description: res.error || 'Unexpected error.',
          tone: 'danger',
        });
        return;
      }
      toast({
        title: 'Binding deleted',
        description: `${binding.label} has been removed.`,
        tone: 'neutral',
      });
      await load();
    });
  };

  const noPhoneNumbers = phoneNumbers.length === 0;

  return (
    <WachatPage
      breadcrumb={CRUMBS}
      title="Numbers & Routing"
      description="Bind your WhatsApp Business API (WABA) numbers to teams and configure their default routing behavior."
      actions={
        <Button
          variant="primary"
          iconLeft={Plus}
          onClick={handleOpenAdd}
          disabled={loading || noPhoneNumbers}
        >
          Add binding
        </Button>
      }
    >
      {loadError ? (
        <Alert tone="danger" title="Could not load bindings">
          {loadError}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </Alert>
      ) : null}

      {noPhoneNumbers && !loading ? (
        <Alert tone="warning" title="No phone numbers linked">
          This project has no WhatsApp Business numbers yet. Add a number to the
          project first, then come back to configure routing.
        </Alert>
      ) : null}

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Phone Number</Th>
              <Th>Label</Th>
              <Th>Assigned Team</Th>
              <Th>Default Route</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {loading ? (
              <Tr>
                <Td colSpan={5} align="center">
                  <div className="flex items-center justify-center gap-2 py-10 text-[var(--st-text-secondary)]">
                    <Spinner size="sm" />
                    <span className="text-sm">Loading bindings…</span>
                  </div>
                </Td>
              </Tr>
            ) : bindings.length === 0 ? (
              <Tr>
                <Td colSpan={5} align="center">
                  <div className="py-8">
                    <EmptyState
                      icon={Phone}
                      title="No routing bindings yet"
                      description={
                        noPhoneNumbers
                          ? 'Link a WhatsApp number to this project to get started.'
                          : 'Click "Add binding" to route a number to a team.'
                      }
                    />
                  </div>
                </Td>
              </Tr>
            ) : (
              bindings.map((binding) => {
                const name = teamName(binding.teamId);
                const route: RouteType =
                  binding.defaultRoute === 'agent' ? 'agent' : 'bot';
                return (
                  <Tr key={binding._id}>
                    <Td className="font-medium">
                      <div className="flex items-center gap-2">
                        <Phone
                          className="h-4 w-4 text-[var(--st-text-tertiary)]"
                          aria-hidden="true"
                        />
                        {phoneLabel(binding.phoneNumberId)}
                      </div>
                    </Td>
                    <Td>{binding.label}</Td>
                    <Td>
                      {name ? (
                        <Badge tone="neutral">{name}</Badge>
                      ) : (
                        <Badge tone="neutral" kind="soft">
                          Unassigned
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {route === 'bot' ? (
                          <Bot
                            className="h-3.5 w-3.5 text-[var(--st-accent)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <User
                            className="h-3.5 w-3.5 text-[var(--st-warn)]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-sm">
                          {route === 'bot' ? 'AI Bot' : 'Human Agent'}
                        </span>
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          label="Edit binding"
                          icon={Edit2}
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleOpenEdit(binding)}
                        />
                        <IconButton
                          label="Delete binding"
                          icon={Trash2}
                          variant="danger"
                          size="sm"
                          disabled={isSaving || deletingId === binding._id}
                          onClick={() => handleDelete(binding)}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </Card>

      {/* Add Dialog */}
      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Routing Binding"
        description="Route a WhatsApp number to a team and pick its default inbound handler."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsAddOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveAdd} loading={isSaving}>
              Add Binding
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Phone Number">
            <SelectField
              value={formData.phoneNumberId || null}
              onChange={(val) =>
                setFormData({ ...formData, phoneNumberId: val ?? '' })
              }
              options={phoneOptions}
              placeholder="Select a number"
            />
          </Field>
          <Field label="Internal Label">
            <Input
              placeholder="e.g. US Sales Team"
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
            />
          </Field>
          <Field label="Assigned Team">
            <SelectField
              value={formData.teamId || null}
              onChange={(val) =>
                setFormData({ ...formData, teamId: val ?? '' })
              }
              options={teamOptions}
              placeholder="Unassigned"
              clearable
            />
          </Field>
          <Field label="Default Route">
            <SelectField
              value={formData.defaultRoute}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  defaultRoute: (val as RouteType) || 'bot',
                })
              }
              options={ROUTE_OPTIONS}
              placeholder="Select routing"
            />
          </Field>
        </div>
      </Modal>

      {/* Edit Dialog */}
      <Modal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Routing Binding"
        description={`Update routing rules and team assignment for ${phoneLabel(formData.phoneNumberId)}.`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsEditOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} loading={isSaving}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Phone Number">
            <SelectField
              value={formData.phoneNumberId || null}
              onChange={(val) =>
                setFormData({ ...formData, phoneNumberId: val ?? '' })
              }
              options={phoneOptions}
              placeholder="Select a number"
            />
          </Field>
          <Field label="Internal Label">
            <Input
              placeholder="e.g. US Sales Team"
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
            />
          </Field>
          <Field label="Assigned Team">
            <SelectField
              value={formData.teamId || null}
              onChange={(val) =>
                setFormData({ ...formData, teamId: val ?? '' })
              }
              options={teamOptions}
              placeholder="Unassigned"
              clearable
            />
          </Field>
          <Field label="Default Route">
            <SelectField
              value={formData.defaultRoute}
              onChange={(val) =>
                setFormData({
                  ...formData,
                  defaultRoute: (val as RouteType) || 'bot',
                })
              }
              options={ROUTE_OPTIONS}
              placeholder="Select routing"
            />
          </Field>
        </div>
      </Modal>
    </WachatPage>
  );
}
