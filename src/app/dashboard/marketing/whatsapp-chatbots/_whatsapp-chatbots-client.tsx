'use client';

import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Switch,
  Badge,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Plus,
  Edit2,
  Trash2,
  MessageSquare,
  Megaphone,
  TrendingUp,
  DollarSign,
  Activity,
  Target,
  Search,
} from 'lucide-react';
import {
  createWhatsappBot,
  updateWhatsappBot,
  deleteWhatsappBot,
} from '@/app/actions/marketing/whatsapp-chatbots.actions';

export function WhatsappBotClient({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Form State
  const [name, setName] = useState<any>('');
  const [phoneNumber, setPhoneNumber] = useState<any>('');
  const [isActive, setIsActive] = useState<any>(false);

  const filteredData = data.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditingItem(null);
    setName('');
    setPhoneNumber('');
    setIsActive(false);
    setIsDialogOpen(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || '');
    setPhoneNumber(item.phoneNumber || '');
    setIsActive(item.isActive || false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      name,
      phoneNumber,
      isActive,
    };

    try {
      if (editingItem) {
        const res = await updateWhatsappBot(editingItem._id, payload);
        if (res.success) {
          setData(data.map((i) => (i._id === editingItem._id ? { ...i, ...payload } : i)));
          toast.success('Record updated successfully.');
          setIsDialogOpen(false);
        } else {
          toast.error(res.error || 'Failed to update record.');
        }
      } else {
        const res = await createWhatsappBot(payload);
        if (res.success) {
          window.location.reload();
        } else {
          toast.error(res.error || 'Failed to create record.');
        }
      }
    } catch (err) {
      toast.error('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    const res = await deleteWhatsappBot(id);
    if (res.success) {
      setData(data.filter((i) => i._id !== id));
      toast.success('Record deleted.');
    } else {
      toast.error(res.error || 'Failed to delete record.');
    }
  };

  return (
    <div className="20ui mx-auto flex w-full max-w-[1180px] flex-col gap-[var(--st-space-5)] px-6 py-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>WhatsApp Chatbots</PageTitle>
          <PageDescription>Manage your WhatsApp Chatbots seamlessly.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <div className="w-full sm:w-64">
            <Field label="Search bots">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bots..."
                iconLeft={Search}
              />
            </Field>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                Create New Bot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit Bot' : 'Create New Bot'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Field label="Name">
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. Sales Assistant"
                  />
                </Field>
                <Field label="Phone Number">
                  <Input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1234567890"
                  />
                </Field>
                <Field label="Active">
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    label="Bot is active"
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button variant="primary" loading={loading} onClick={handleSave}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PageActions>
      </PageHeader>

      {/* Global Campaign Dashboard */}
      <Card variant="outlined">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
              <Megaphone className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Global Campaign Dashboard</CardTitle>
              <CardDescription>Aggregated metrics and cross-channel ROI</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Cross-Channel ROI"
              value="245%"
              icon={TrendingUp}
              delta={{ value: '+12.5% vs last month', tone: 'up' }}
            />
            <StatCard
              label="Revenue Attributed"
              value="$124,500"
              icon={DollarSign}
              delta={{ value: '+8.2% vs last month', tone: 'up' }}
            />
            <StatCard
              label="Active Campaigns"
              value={data.filter((d) => d.isActive).length}
              icon={Activity}
              delta={{ value: '+5.2% vs last month', tone: 'up' }}
            />
            <StatCard
              label="Cross-Channel Conversion"
              value="18.4%"
              icon={Target}
              delta={{ value: '-2.4% vs last month', tone: 'down' }}
            />
          </div>
        </CardBody>
      </Card>

      {filteredData.length === 0 ? (
        <Card variant="outlined">
          <CardBody>
            <EmptyState
              icon={MessageSquare}
              title="No bots found"
              description="Create your first WhatsApp chatbot to get started."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                  Create New Bot
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card variant="outlined" padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Phone Number</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredData.map((item) => (
                <Tr key={item._id}>
                  <Td className="font-medium">{String(item.name || '')}</Td>
                  <Td>{String(item.phoneNumber || '')}</Td>
                  <Td>
                    {item.isActive ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="neutral">Inactive</Badge>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <IconButton
                        label="Edit bot"
                        icon={Edit2}
                        variant="ghost"
                        onClick={() => openEdit(item)}
                      />
                      <IconButton
                        label="Delete bot"
                        icon={Trash2}
                        variant="ghost"
                        onClick={() => handleDelete(item._id)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
