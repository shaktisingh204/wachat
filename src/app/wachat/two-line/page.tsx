'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Activity, Bot, Clock, Edit2, Phone, Plus, Trash2, User, Users } from 'lucide-react';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useZoruToast,
} from '@/components/zoruui';

import {
  WaPage,
  PageHeader,
  Section,
  EmptyState,
  WaButton,
  StatusPill,
  MetricTile,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

type Team = { id: string; name: string };
type RouteType = 'bot' | 'agent';

interface PhoneNumberRow {
  id: string;
  number: string;
  label: string;
  teamId: string;
  defaultRoute: RouteType;
}

const TEAMS: Team[] = [
  { id: 'team_1', name: 'Sales' },
  { id: 'team_2', name: 'Support' },
  { id: 'team_3', name: 'Marketing' },
  { id: 'team_4', name: 'Global Ops' },
];

const INITIAL_NUMBERS: PhoneNumberRow[] = [
  { id: 'num_1', number: '+1 (415) 555-0142', label: 'Primary sales', teamId: 'team_1', defaultRoute: 'agent' },
  { id: 'num_2', number: '+1 (415) 555-0177', label: 'Support bot', teamId: 'team_2', defaultRoute: 'bot' },
];

export default function MultiNumberManagementPage() {
  const { toast } = useZoruToast();
  const [numbers, setNumbers] = useState<PhoneNumberRow[]>(INITIAL_NUMBERS);
  const [isHydrated, setIsHydrated] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PhoneNumberRow>>({});

  useEffect(() => setIsHydrated(true), []);
  if (!isHydrated) return null;

  const handleOpenAdd = () => {
    setFormData({ number: '', label: '', teamId: TEAMS[0].id, defaultRoute: 'bot' });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (num: PhoneNumberRow) => {
    setEditingId(num.id);
    setFormData({ ...num });
    setIsEditOpen(true);
  };

  const handleSaveAdd = () => {
    if (!formData.number || !formData.label) {
      toast({ title: 'Error', description: 'Please fill in all required fields.' });
      return;
    }
    const newNumber: PhoneNumberRow = {
      id: `num_${Date.now()}`,
      number: formData.number!,
      label: formData.label!,
      teamId: formData.teamId || TEAMS[0].id,
      defaultRoute: (formData.defaultRoute as RouteType) || 'bot',
    };
    setNumbers([...numbers, newNumber]);
    setIsAddOpen(false);
    toast({ title: 'Number added', description: `${newNumber.number} has been added.` });
  };

  const handleSaveEdit = () => {
    if (!formData.number || !formData.label) {
      toast({ title: 'Error', description: 'Please fill in all required fields.' });
      return;
    }
    setNumbers((prev) => prev.map((n) => (n.id === editingId ? ({ ...n, ...formData } as PhoneNumberRow) : n)));
    setIsEditOpen(false);
    toast({ title: 'Number updated', description: 'Your changes have been saved.' });
  };

  const handleDelete = (id: string) => {
    setNumbers((prev) => prev.filter((n) => n.id !== id));
    toast({ title: 'Number deleted' });
  };

  return (
    <WaPage>
      <PageHeader
        title="Numbers and routing"
        description="Bind WhatsApp Business API numbers to specific teams and configure their default routing."
        kicker="Wachat · routing"
        backHref="/wachat"
        eyebrowIcon={Users}
        actions={
          <WaButton leftIcon={Plus} onClick={handleOpenAdd}>Add number</WaButton>
        }
      />

      {(() => {
        const botRoutes = numbers.filter((n) => n.defaultRoute === 'bot').length;
        const agentRoutes = numbers.filter((n) => n.defaultRoute === 'agent').length;
        const teamsCovered = new Set(numbers.map((n) => n.teamId)).size;
        return (
          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricTile label="Numbers" value={numbers.length} icon={Phone} delay={0.02} />
            <MetricTile label="Teams covered" value={teamsCovered} icon={Users} delay={0.04} />
            <MetricTile label="Routes to bot" value={botRoutes} icon={Bot} delay={0.06} />
            <MetricTile label="Routes to agent" value={agentRoutes} icon={User} delay={0.08} />
            <MetricTile label="Last change" value={<span className="text-[15px]">Just now</span>} icon={Clock} delay={0.1} />
          </section>
        );
      })()}

      {/* Routing matrix — teams as columns, numbers as rows */}
      {numbers.length > 0 && (
        <Section title="Routing matrix" description="Visual grid of which team owns each number, click to reassign.">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                    Number
                  </th>
                  {TEAMS.map((t) => (
                    <th key={t.id} className="px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr key={n.id} className="border-t border-zinc-100">
                    <td className="sticky left-0 z-10 bg-white px-2 py-2 font-mono text-[11.5px] text-zinc-900">
                      {n.number}
                    </td>
                    {TEAMS.map((t) => {
                      const active = n.teamId === t.id;
                      return (
                        <td key={t.id} className="px-1 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => setNumbers((prev) => prev.map((x) => (x.id === n.id ? { ...x, teamId: t.id } : x)))}
                            className={`grid h-7 w-full place-items-center rounded-lg border text-[11px] font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                              active
                                ? 'border-transparent text-white'
                                : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-900 hover:text-zinc-900'
                            }`}
                            style={active ? { background: 'var(--mt-accent)' } : undefined}
                            aria-label={`Assign ${n.number} to ${t.name}`}
                          >
                            {active ? n.defaultRoute === 'bot' ? <Bot className="h-3 w-3" strokeWidth={2.5} /> : <User className="h-3 w-3" strokeWidth={2.5} /> : '·'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Routing list" description="Each WABA number routes to a team and a default destination.">
        {numbers.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No numbers configured"
            description="Add a number to begin routing inbound chats."
            action={<WaButton leftIcon={Plus} onClick={handleOpenAdd}>Add number</WaButton>}
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {numbers.map((num, i) => {
                const team = TEAMS.find((t) => t.id === num.teamId);
                return (
                  <m.li
                    key={num.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.3, delay: i * 0.03, ease: EASE_OUT }}
                    className="flex items-center justify-between gap-3 px-1 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                        style={{ background: 'var(--mt-accent-soft)' }}
                      >
                        <Phone className="h-4 w-4" style={{ color: 'var(--mt-accent)' }} strokeWidth={2.25} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[13px] tabular-nums text-zinc-950">{num.number}</p>
                        <p className="truncate text-[11.5px] text-zinc-500">{num.label}</p>
                      </div>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      {team ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                          {team.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400">Unassigned</span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-zinc-200">
                        {num.defaultRoute === 'bot' ? <Bot className="h-3 w-3" strokeWidth={2.25} /> : <User className="h-3 w-3" strokeWidth={2.25} />}
                        <span className="capitalize">{num.defaultRoute}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenEdit(num)} className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Edit">
                        <Edit2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                      <button onClick={() => handleDelete(num.id)} className="grid h-7 w-7 place-items-center rounded-full text-rose-500 hover:bg-rose-50" aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>

      {/* Add */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add new number</ZoruDialogTitle>
            <ZoruDialogDescription>Register a new WhatsApp number and configure its routing rules.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="number">Phone number</Label>
              <Input id="number" placeholder="+1 (555) 000-0000" value={formData.number || ''} onChange={(e) => setFormData({ ...formData, number: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="label">Internal label</Label>
              <Input id="label" placeholder="e.g. US sales team" value={formData.label || ''} onChange={(e) => setFormData({ ...formData, label: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label>Assigned team</Label>
              <Select value={formData.teamId} onValueChange={(val) => setFormData({ ...formData, teamId: val })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select a team" /></SelectTrigger>
                <SelectContent>{TEAMS.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Default route</Label>
              <Select value={formData.defaultRoute} onValueChange={(val) => setFormData({ ...formData, defaultRoute: val as RouteType })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select routing" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">AI bot</SelectItem>
                  <SelectItem value="agent">Human agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</WaButton>
            <WaButton onClick={handleSaveAdd}>Add number</WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit configuration</ZoruDialogTitle>
            <ZoruDialogDescription>Update routing rules and team assignment for {formData.number}.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-label">Internal label</Label>
              <Input id="edit-label" value={formData.label || ''} onChange={(e) => setFormData({ ...formData, label: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid gap-1.5">
              <Label>Assigned team</Label>
              <Select value={formData.teamId} onValueChange={(val) => setFormData({ ...formData, teamId: val })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select a team" /></SelectTrigger>
                <SelectContent>{TEAMS.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Default route</Label>
              <Select value={formData.defaultRoute} onValueChange={(val) => setFormData({ ...formData, defaultRoute: val as RouteType })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select routing" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">AI bot</SelectItem>
                  <SelectItem value="agent">Human agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</WaButton>
            <WaButton onClick={handleSaveEdit}>Save changes</WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
