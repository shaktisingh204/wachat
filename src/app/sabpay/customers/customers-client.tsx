'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Mail, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';

import {
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Menu,
  MenuItem,
  Modal,
  StatCard,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  toast,
  Tr,
} from '@/components/sabcrm/20ui';
import type { SabpayCustomer, SabpayMode } from '@/lib/sabpay/types';

import {
  createSabpayCustomer,
  deleteSabpayCustomer,
  getSabpayCustomers,
  updateSabpayCustomer,
} from '../actions/customers';
import { ConfirmAction } from '../_components/confirm-action';
import { ListToolbar } from '../_components/list-toolbar';
import { LoadMore } from '../_components/load-more';

/** Pull the dashboard's free-text note out of the API's notes object. */
function noteText(customer: SabpayCustomer): string {
  const note = customer.notes?.note;
  return typeof note === 'string' ? note : '';
}

export function CustomersClient({
  initialCustomers,
  mode,
  pageSize,
}: {
  initialCustomers: SabpayCustomer[];
  mode: SabpayMode;
  pageSize: number;
}) {
  const router = useRouter();

  /* ── List + search ──────────────────────────────────────────────────── */
  const [customers, setCustomers] = React.useState<SabpayCustomer[]>(initialCustomers);
  const [search, setSearch] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialCustomers.length === pageSize);
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Monotonic sequence so a slow earlier search can never clobber a newer one.
  const requestSeq = React.useRef(0);
  const didMount = React.useRef(false);

  React.useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const seq = ++requestSeq.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await getSabpayCustomers({
          search: search.trim() || undefined,
          limit: pageSize,
        });
        if (seq !== requestSeq.current) return;
        setCustomers(rows);
        setHasMore(rows.length === pageSize);
      } catch {
        if (seq !== requestSeq.current) return;
        toast({ title: 'Could not search customers', tone: 'danger' });
      } finally {
        if (seq === requestSeq.current) setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, pageSize]);

  async function loadMore() {
    const last = customers[customers.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await getSabpayCustomers({
        search: search.trim() || undefined,
        before: last.createdAt,
        limit: pageSize,
      });
      setCustomers((prev) => [...prev, ...rows]);
      setHasMore(rows.length === pageSize);
    } catch {
      toast({ title: 'Could not load more customers', tone: 'danger' });
    } finally {
      setLoadingMore(false);
    }
  }

  /* ── Add / Edit modal (shared) ──────────────────────────────────────── */
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabpayCustomer | null>(null);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [gstin, setGstin] = React.useState('');
  const [note, setNote] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function openAdd() {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setGstin('');
    setNote('');
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(customer: SabpayCustomer) {
    setEditing(customer);
    setName(customer.name);
    setEmail(customer.email ?? '');
    setPhone(customer.contact ?? '');
    setGstin(customer.gstin ?? '');
    setNote(noteText(customer));
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Enter the customer’s name.');
      return;
    }
    setSaving(true);
    const body = {
      name: trimmedName,
      email: email.trim() || undefined,
      contact: phone.trim() || undefined,
      gstin: gstin.trim() || undefined,
      notes: note.trim() ? { note: note.trim() } : undefined,
    };
    const result = editing
      ? await updateSabpayCustomer(editing.id, body)
      : await createSabpayCustomer(body);
    setSaving(false);
    const saved = result.customer;
    if (result.error || !saved) {
      setFormError(result.error || 'Could not save the customer.');
      return;
    }
    setModalOpen(false);
    if (editing) {
      setCustomers((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      toast({ title: 'Customer updated', description: saved.name, tone: 'success' });
    } else {
      setCustomers((prev) => [saved, ...prev]);
      toast({ title: 'Customer created', description: saved.id, tone: 'success' });
    }
    router.refresh();
  }

  /* ── Delete ─────────────────────────────────────────────────────────── */
  const [deleteTarget, setDeleteTarget] = React.useState<SabpayCustomer | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteSabpayCustomer(deleteTarget.id);
    if (result.error || !result.ok) {
      const message = result.error || 'Could not delete the customer.';
      toast({ title: 'Delete failed', description: message, tone: 'danger' });
      // Re-throw so ConfirmAction keeps the dialog open next to the toast.
      throw new Error(message);
    }
    setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    toast({ title: 'Customer deleted', description: deleteTarget.name, tone: 'success' });
    router.refresh();
  }

  const trimmedSearch = search.trim();

  const summary = React.useMemo(() => {
    let withEmail = 0;
    let withGstin = 0;
    for (const c of customers) {
      if (c.email) withEmail += 1;
      if (c.gstin) withGstin += 1;
    }
    return { total: customers.length, withEmail, withGstin };
  }, [customers]);

  const createButton = (
    <Button variant="primary" iconLeft={<Plus size={15} />} onClick={openAdd}>
      Add customer
    </Button>
  );

  return (
    <>
      <ListToolbar
        left={
          <div style={{ width: 280, maxWidth: '100%' }}>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              aria-label="Search customers"
            />
          </div>
        }
        actions={createButton}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--st-space-4, 16px)',
        }}
      >
        <StatCard label="Customers" value={summary.total} icon={Users} />
        <StatCard label="With email" value={summary.withEmail} icon={Mail} />
        <StatCard label="With GSTIN" value={summary.withGstin} icon={FileText} />
      </div>

      <Card>
        <CardBody>
          {customers.length === 0 ? (
            searching ? (
              <p style={{ margin: 0, color: 'var(--st-text-muted)' }}>Searching…</p>
            ) : trimmedSearch ? (
              <EmptyState
                icon={<Users size={22} />}
                title={`No customers match “${trimmedSearch}”`}
                description={`No ${mode}-mode customer matches your search. Try a different name, email, or phone number.`}
                action={
                  <Button variant="ghost" onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Users size={22} />}
                title={`No customers in ${mode} mode yet`}
                description="Customers store contact and billing details you can attach to payments, subscriptions, and invoices. Add your first one to get started."
                action={createButton}
              />
            )
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Customer</Th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Created</Th>
                  <Th>
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      Actions
                    </span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {customers.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link
                        href={`/sabpay/customers/${c.id}`}
                        style={{ fontFamily: 'var(--st-font-mono, monospace)', fontSize: 12.5 }}
                      >
                        {c.id}
                      </Link>
                    </Td>
                    <Td style={{ fontWeight: 600 }}>{c.name}</Td>
                    <Td>{c.email || '—'}</Td>
                    <Td>{c.contact || '—'}</Td>
                    <Td>{new Date(c.createdAt).toLocaleString()}</Td>
                    <Td style={{ textAlign: 'right' }}>
                      <Menu
                        align="end"
                        label={`Actions for ${c.name}`}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<MoreHorizontal size={15} />}
                            aria-label={`Actions for ${c.name}`}
                          />
                        }
                      >
                        <MenuItem icon={Pencil} onSelect={() => openEdit(c)}>
                          Edit
                        </MenuItem>
                        <MenuItem icon={Trash2} danger onSelect={() => setDeleteTarget(c)}>
                          Delete
                        </MenuItem>
                      </Menu>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <LoadMore hasMore={hasMore && customers.length > 0} loading={loadingMore} onClick={loadMore} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit customer' : 'Add a customer'}
        description={
          editing
            ? `Update ${editing.name}’s details. Changes apply everywhere this customer is referenced.`
            : `Creates a ${mode}-mode customer you can attach to payments, subscriptions, and invoices.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sabpay-customer-form" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add customer'}
            </Button>
          </>
        }
      >
        <form
          id="sabpay-customer-form"
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field label="Name" required error={formError}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gauri Kumari"
              maxLength={120}
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gauri@example.com"
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </Field>
          <Field label="GSTIN" help="Optional. Printed on invoices issued to this customer.">
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
            />
          </Field>
          <Field label="Notes" help="Internal — never shown to the customer.">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VIP — fast-track support requests."
              rows={3}
              maxLength={500}
            />
          </Field>
        </form>
      </Modal>

      <ConfirmAction
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.name ?? 'this customer'}?`}
        description="The customer record is removed permanently. Payments, subscriptions, and invoices already linked to it are kept."
        confirmLabel="Delete customer"
        tone="danger"
      />
    </>
  );
}
