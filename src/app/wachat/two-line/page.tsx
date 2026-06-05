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
  Select,
  Badge,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, Bot, User } from 'lucide-react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type Team = { id: string; name: string };
type RouteType = 'bot' | 'agent';

interface PhoneNumber {
  id: string;
  number: string;
  label: string;
  teamId: string;
  defaultRoute: RouteType;
}

const TEAMS: Team[] = [
  { id: 'team_1', name: 'Sales Team' },
  { id: 'team_2', name: 'Support Team' },
  { id: 'team_3', name: 'Marketing' },
  { id: 'team_4', name: 'Global Ops' },
];

const TEAM_OPTIONS = TEAMS.map((t) => ({ value: t.id, label: t.name }));

const ROUTE_OPTIONS = [
  { value: 'bot', label: 'AI Bot' },
  { value: 'agent', label: 'Human Agent' },
];

const INITIAL_NUMBERS: PhoneNumber[] = [
  {
    id: 'num_1',
    number: '+1 (415) 555-0142',
    label: 'Primary Sales',
    teamId: 'team_1',
    defaultRoute: 'agent',
  },
  {
    id: 'num_2',
    number: '+1 (415) 555-0177',
    label: 'Support Bot',
    teamId: 'team_2',
    defaultRoute: 'bot',
  },
];

export default function MultiNumberManagementPage() {
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<PhoneNumber[]>(INITIAL_NUMBERS);
  const [isHydrated, setIsHydrated] = useState(false);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PhoneNumber>>({});

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null; // Prevent hydration mismatch

  const handleOpenAdd = () => {
    setFormData({
      number: '',
      label: '',
      teamId: TEAMS[0].id,
      defaultRoute: 'bot',
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (num: PhoneNumber) => {
    setEditingId(num.id);
    setFormData({ ...num });
    setIsEditOpen(true);
  };

  const handleSaveAdd = () => {
    if (!formData.number || !formData.label) {
      toast({ title: 'Error', description: 'Please fill in all required fields.', tone: 'danger' });
      return;
    }
    const newNumber: PhoneNumber = {
      id: `num_${Date.now()}`,
      number: formData.number,
      label: formData.label,
      teamId: formData.teamId || TEAMS[0].id,
      defaultRoute: (formData.defaultRoute as RouteType) || 'bot',
    };
    setNumbers([...numbers, newNumber]);
    setIsAddOpen(false);
    toast({ title: 'Number added', description: `${newNumber.number} has been added.`, tone: 'success' });
  };

  const handleSaveEdit = () => {
    if (!formData.number || !formData.label) {
      toast({ title: 'Error', description: 'Please fill in all required fields.', tone: 'danger' });
      return;
    }
    setNumbers(
      numbers.map((n) =>
        n.id === editingId ? ({ ...n, ...formData } as PhoneNumber) : n
      )
    );
    setIsEditOpen(false);
    toast({ title: 'Number updated', description: 'Your changes have been saved.', tone: 'success' });
  };

  const handleDelete = (id: string) => {
    setNumbers(numbers.filter((n) => n.id !== id));
    toast({ title: 'Number deleted', description: 'The phone number has been removed.', tone: 'neutral' });
  };

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Numbers & Routing' },
      ]}
      title="Numbers & Routing"
      description="Manage your WhatsApp Business API (WABA) numbers. Bind numbers to specific teams and configure their default routing behavior."
      actions={
        <Button variant="primary" iconLeft={Plus} onClick={handleOpenAdd}>
          Add number
        </Button>
      }
    >
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
            {numbers.length === 0 ? (
              <Tr>
                <Td
                  colSpan={5}
                  align="center"
                  style={{ paddingTop: 32, paddingBottom: 32, color: 'var(--st-text-secondary)' }}
                >
                  No phone numbers configured. Click "Add number" to get started.
                </Td>
              </Tr>
            ) : (
              numbers.map((num) => {
                const team = TEAMS.find((t) => t.id === num.teamId);
                return (
                  <Tr key={num.id}>
                    <Td style={{ fontWeight: 500 }}>
                      <div className="flex items-center gap-2">
                        <Phone
                          className="h-4 w-4"
                          style={{ color: 'var(--st-text-tertiary)' }}
                          aria-hidden="true"
                        />
                        {num.number}
                      </div>
                    </Td>
                    <Td>{num.label}</Td>
                    <Td>
                      {team ? (
                        <Badge tone="neutral">{team.name}</Badge>
                      ) : (
                        <span style={{ color: 'var(--st-text-secondary)' }}>Unassigned</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {num.defaultRoute === 'bot' ? (
                          <Bot
                            className="h-3.5 w-3.5"
                            style={{ color: 'var(--st-accent)' }}
                            aria-hidden="true"
                          />
                        ) : (
                          <User
                            className="h-3.5 w-3.5"
                            style={{ color: 'var(--st-warn)' }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="capitalize text-sm">{num.defaultRoute}</span>
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          label="Edit number"
                          icon={Edit2}
                          size="sm"
                          onClick={() => handleOpenEdit(num)}
                        />
                        <IconButton
                          label="Delete number"
                          icon={Trash2}
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(num.id)}
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
        title="Add New Number"
        description="Register a new WhatsApp number and configure its routing rules."
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveAdd}>
              Add Number
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Phone Number">
            <Input
              placeholder="+1 (555) 000-0000"
              value={formData.number || ''}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            />
          </Field>
          <Field label="Internal Label">
            <Input
              placeholder="e.g. US Sales Team"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            />
          </Field>
          <Field label="Assigned Team">
            <Select
              value={formData.teamId}
              onChange={(val) => setFormData({ ...formData, teamId: val ?? undefined })}
              options={TEAM_OPTIONS}
              placeholder="Select a team"
            />
          </Field>
          <Field label="Default Route">
            <Select
              value={formData.defaultRoute}
              onChange={(val) =>
                setFormData({ ...formData, defaultRoute: (val as RouteType) ?? undefined })
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
        title="Edit Number Configuration"
        description={`Update routing rules and team assignment for ${formData.number}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Internal Label">
            <Input
              placeholder="e.g. US Sales Team"
              value={formData.label || ''}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            />
          </Field>
          <Field label="Assigned Team">
            <Select
              value={formData.teamId}
              onChange={(val) => setFormData({ ...formData, teamId: val ?? undefined })}
              options={TEAM_OPTIONS}
              placeholder="Select a team"
            />
          </Field>
          <Field label="Default Route">
            <Select
              value={formData.defaultRoute}
              onChange={(val) =>
                setFormData({ ...formData, defaultRoute: (val as RouteType) ?? undefined })
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
