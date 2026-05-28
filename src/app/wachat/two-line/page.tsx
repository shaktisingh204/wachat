'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  useZoruToast,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Label,
} from '@/components/zoruui';
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, Bot, User } from 'lucide-react';

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
  const { toast } = useZoruToast();
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
      toast({ title: 'Error', description: 'Please fill in all required fields.' });
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
    toast({ title: 'Number added', description: `${newNumber.number} has been added.` });
  };

  const handleSaveEdit = () => {
    if (!formData.number || !formData.label) {
      toast({ title: 'Error', description: 'Please fill in all required fields.' });
      return;
    }
    setNumbers(
      numbers.map((n) =>
        n.id === editingId ? ({ ...n, ...formData } as PhoneNumber) : n
      )
    );
    setIsEditOpen(false);
    toast({ title: 'Number updated', description: 'Your changes have been saved.' });
  };

  const handleDelete = (id: string) => {
    setNumbers(numbers.filter((n) => n.id !== id));
    toast({ title: 'Number deleted', description: 'The phone number has been removed.' });
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Numbers & Routing</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="mt-5 flex items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Numbers & Routing
          </h1>
          <p className="mt-1.5 max-w-[680px] text-[13px] text-zoru-ink-muted">
            Manage your WhatsApp Business API (WABA) numbers. Bind numbers to specific
            teams and configure their default routing behavior.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleOpenAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add number
          </Button>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone Number</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Assigned Team</TableHead>
              <TableHead>Default Route</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numbers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-zoru-ink-muted">
                  No phone numbers configured. Click "Add number" to get started.
                </TableCell>
              </TableRow>
            ) : (
              numbers.map((num) => {
                const team = TEAMS.find((t) => t.id === num.teamId);
                return (
                  <TableRow key={num.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-zoru-ink-subtle" />
                        {num.number}
                      </div>
                    </TableCell>
                    <TableCell>{num.label}</TableCell>
                    <TableCell>
                      {team ? (
                        <Badge
                          variant="secondary"
                          className="rounded-[var(--zoru-radius-sm)] font-normal text-[11px]"
                        >
                          {team.name}
                        </Badge>
                      ) : (
                        <span className="text-zoru-ink-muted">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {num.defaultRoute === 'bot' ? (
                          <Bot className="h-3.5 w-3.5 text-zoru-primary" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-zoru-warning" />
                        )}
                        <span className="capitalize text-sm">{num.defaultRoute}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(num)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(num.id)}
                          className="h-8 w-8 text-zoru-danger hover:bg-zoru-danger/10 hover:text-zoru-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add New Number</ZoruDialogTitle>
            <ZoruDialogDescription>
              Register a new WhatsApp number and configure its routing rules.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="number">Phone Number</Label>
              <Input
                id="number"
                placeholder="+1 (555) 000-0000"
                value={formData.number || ''}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="label">Internal Label</Label>
              <Input
                id="label"
                placeholder="e.g. US Sales Team"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Assigned Team</Label>
              <Select
                value={formData.teamId}
                onValueChange={(val) => setFormData({ ...formData, teamId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Default Route</Label>
              <Select
                value={formData.defaultRoute}
                onValueChange={(val) =>
                  setFormData({ ...formData, defaultRoute: val as RouteType })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select routing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">AI Bot</SelectItem>
                  <SelectItem value="agent">Human Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdd}>Add Number</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Edit Number Configuration</ZoruDialogTitle>
            <ZoruDialogDescription>
              Update routing rules and team assignment for {formData.number}.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-label">Internal Label</Label>
              <Input
                id="edit-label"
                placeholder="e.g. US Sales Team"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Assigned Team</Label>
              <Select
                value={formData.teamId}
                onValueChange={(val) => setFormData({ ...formData, teamId: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Default Route</Label>
              <Select
                value={formData.defaultRoute}
                onValueChange={(val) =>
                  setFormData({ ...formData, defaultRoute: val as RouteType })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select routing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">AI Bot</SelectItem>
                  <SelectItem value="agent">Human Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="ghost" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
