'use client';

import React, { useState } from 'react';
import {
  ShieldCheck, FileText, Activity, Clock, MapPin,
  Search, Filter, Download, AlertTriangle, CheckCircle,
  Hash, Server, Lock, Monitor, FileSignature, ChevronDown,
  Plus, ShieldAlert, XCircle, FileBadge, Maximize2,
  ArrowRight, RefreshCw, Printer, Database, Settings, Calendar,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  Badge,
  Dot,
  Progress,
  Switch,
  Separator,
  Alert,
  Modal,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

// --- MOCK DATA ---

const MOCK_EVENTS = Array.from({ length: 150 }).map(() => {
  const date = new Date(Date.now() - Math.random() * 10000000000);
  const actions = ['Document Viewed', 'Signature Added', 'Authentication Failed', 'Document Signed', 'IP Address Changed', 'Certificate Issued', 'Audit Log Exported', 'Settings Changed'];
  const actors = ['Harsh Khandelwal', 'John Doe', 'Jane Smith', 'System', 'Alice Johnson', 'Bob Williams', 'API Service'];
  const locations = ['New York, US', 'London, UK', 'Tokyo, JP', 'Berlin, DE', 'Sydney, AU', 'Mumbai, IN', 'Unknown'];
  const statuses = ['Success', 'Success', 'Success', 'Warning', 'Failed'];
  const devices = ['MacBook Pro 16"', 'iPhone 14 Pro', 'Windows 11 PC', 'iPad Air', 'Android Device', 'Server Node'];
  const browsers = ['Chrome 118', 'Safari 17', 'Firefox 119', 'Edge 118', 'Unknown', 'SabDesk Desktop App'];

  return {
    id: `EVT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    timestamp: date.toISOString(),
    formattedDate: date.toLocaleString(),
    action: actions[Math.floor(Math.random() * actions.length)],
    actor: actors[Math.floor(Math.random() * actors.length)],
    ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    location: locations[Math.floor(Math.random() * locations.length)],
    hash: `0x${Array.from({ length: 64 }).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    device: devices[Math.floor(Math.random() * devices.length)],
    browser: browsers[Math.floor(Math.random() * browsers.length)],
    details: 'Cryptographic verification passed. RSA-2048 key utilized.',
  };
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

const MOCK_IPS = Array.from({ length: 45 }).map((_, i) => ({
  id: `IP-${i}`,
  address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  location: ['San Francisco, CA', 'Austin, TX', 'Toronto, CA', 'Frankfurt, DE', 'Singapore, SG'][Math.floor(Math.random() * 5)],
  isp: ['Comcast', 'AT&T', 'Verizon', 'Vodafone', 'DigitalOcean', 'AWS'][Math.floor(Math.random() * 6)],
  riskScore: Math.floor(Math.random() * 100),
  lastSeen: new Date(Date.now() - Math.random() * 1000000000).toLocaleString(),
  associatedAccounts: Math.floor(Math.random() * 5) + 1,
  status: ['Allowed', 'Allowed', 'Allowed', 'Suspicious', 'Blocked'][Math.floor(Math.random() * 5)],
  sessions: Math.floor(Math.random() * 500) + 10,
}));

const MOCK_CERTIFICATES = Array.from({ length: 25 }).map(() => ({
  id: `CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
  documentName: ['NDA_Q3_2024.pdf', 'Employment_Contract_Jane.docx', 'Vendor_Agreement_V2.pdf', 'Board_Resolution_Oct.pdf'][Math.floor(Math.random() * 4)],
  signers: Array.from({ length: Math.floor(Math.random() * 3) + 1 }).map(() => ['Alice M.', 'Bob T.', 'Charlie K.', 'Diana P.'][Math.floor(Math.random() * 4)]),
  completionDate: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString(),
  blockchainTx: `0x${Array.from({ length: 40 }).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
  status: 'Completed',
  size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
  encryption: 'AES-256-GCM',
}));

type Certificate = (typeof MOCK_CERTIFICATES)[number];

// --- HELPERS ---

type EventStatus = 'Success' | 'Warning' | 'Failed' | string;

function StatusBadge({ status }: { status: EventStatus }) {
  if (status === 'Success') {
    return <Badge tone="success"><CheckCircle size={12} aria-hidden="true" /> {status}</Badge>;
  }
  if (status === 'Warning') {
    return <Badge tone="warning"><AlertTriangle size={12} aria-hidden="true" /> {status}</Badge>;
  }
  return <Badge tone="danger"><XCircle size={12} aria-hidden="true" /> {status}</Badge>;
}

function IpStatusBadge({ status }: { status: string }) {
  if (status === 'Allowed') return <Badge tone="success">{status}</Badge>;
  if (status === 'Suspicious') return <Badge tone="warning">{status}</Badge>;
  return <Badge tone="danger">{status}</Badge>;
}

function riskTone(score: number): 'success' | 'warning' | 'danger' {
  if (score < 30) return 'success';
  if (score < 70) return 'warning';
  return 'danger';
}

// --- TABS ---

function TimelineTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const rows = MOCK_EVENTS
    .filter((e) => e.hash.includes(searchTerm) || e.action.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <Card variant="outlined" padding="sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:w-96">
            <Field label="Search events">
              <Input
                iconLeft={Search}
                placeholder="Search hash, IP, or event..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex w-full gap-3 md:w-auto">
            <Button variant="outline" iconLeft={Filter} onClick={() => toast.info('Filters coming soon')}>
              Filter
            </Button>
            <Button variant="primary" iconLeft={Download} onClick={() => toast.success('Audit log exported to CSV')}>
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card variant="outlined" padding="none">
        <div className="overflow-x-auto">
          <Table hover>
            <THead>
              <Tr>
                <Th>Event &amp; Hash</Th>
                <Th>Actor &amp; Device</Th>
                <Th>Location &amp; IP</Th>
                <Th>Time</Th>
                <Th align="right">Status</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((event) => (
                <Tr key={event.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                        {event.action}
                        {event.action.includes('Signed') && (
                          <FileSignature size={14} className="text-[var(--st-accent)]" aria-hidden="true" />
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-1 font-[family-name:var(--st-font-mono)] text-xs text-[var(--st-text-tertiary)]">
                        <Hash size={12} aria-hidden="true" />
                        {event.hash.substring(0, 16)}...{event.hash.substring(event.hash.length - 8)}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-sm text-[var(--st-text-secondary)]">{event.actor}</span>
                      <span className="mt-1 flex items-center gap-1 text-xs text-[var(--st-text-tertiary)]">
                        <Monitor size={12} aria-hidden="true" />
                        {event.device} • {event.browser}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1 text-sm text-[var(--st-text-secondary)]">
                        <MapPin size={12} aria-hidden="true" className="text-[var(--st-text-tertiary)]" />
                        {event.location}
                      </span>
                      <span className="mt-1 font-[family-name:var(--st-font-mono)] text-xs text-[var(--st-text-tertiary)]">{event.ip}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-sm text-[var(--st-text-secondary)]">{event.formattedDate.split(',')[0]}</span>
                      <span className="mt-1 text-xs text-[var(--st-text-tertiary)]">{event.formattedDate.split(',')[1]}</span>
                    </div>
                  </Td>
                  <Td align="right">
                    <StatusBadge status={event.status} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
        <Separator />
        <div className="flex justify-center p-4">
          <Button variant="ghost" iconRight={ChevronDown} onClick={() => toast.info('Loading more events')}>
            Load More Events
          </Button>
        </div>
      </Card>
    </div>
  );
}

function NetworkTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const rows = MOCK_IPS
    .filter((ip) => ip.address.includes(search))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card variant="outlined" padding="md" className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="text-[var(--st-accent)]" size={20} aria-hidden="true" />
              Geographic Traffic Distribution
            </CardTitle>
            <IconButton label="Expand map" icon={Maximize2} variant="ghost" onClick={() => toast.info('Fullscreen map coming soon')} />
          </CardHeader>
          <CardBody>
            <div className="flex h-64 w-full items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] text-center">
              <div>
                <MapPin size={48} className="mx-auto mb-3 text-[var(--st-accent)]" aria-hidden="true" />
                <p className="text-sm text-[var(--st-text-secondary)]">Interactive map visualization would render here.</p>
                <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">Showing 45 active nodes across 12 regions</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card variant="outlined" padding="md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="text-[var(--st-danger)]" size={20} aria-hidden="true" />
              High Risk IPs
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {MOCK_IPS.filter((ip) => ip.riskScore > 70).slice(0, 4).map((ip) => (
              <Card key={ip.id} variant="outlined" padding="sm" className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--st-font-mono)] text-sm text-[var(--st-text)]">{ip.address}</span>
                  <Badge tone="danger">Risk: {ip.riskScore}</Badge>
                </div>
                <div className="flex justify-between text-xs text-[var(--st-text-secondary)]">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} aria-hidden="true" /> {ip.location}
                  </span>
                  <span>{ip.sessions} sessions</span>
                </div>
              </Card>
            ))}
            <Button variant="secondary" block onClick={() => toast.info('Opening threat center')}>
              View All Threats
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card variant="outlined" padding="none">
        <CardHeader className="flex items-center justify-between p-5">
          <CardTitle>IP Access Log</CardTitle>
          <div className="w-56">
            <Field label="Search IP addresses">
              <Input
                inputSize="sm"
                iconLeft={Search}
                placeholder="Search IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table hover>
            <THead>
              <Tr>
                <Th>IP Address</Th>
                <Th>Location / ISP</Th>
                <Th>Risk Score</Th>
                <Th>Last Seen</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((ip) => (
                <Tr key={ip.id}>
                  <Td>
                    <span className="font-[family-name:var(--st-font-mono)] text-sm text-[var(--st-text)]">{ip.address}</span>
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="text-sm text-[var(--st-text-secondary)]">{ip.location}</span>
                      <span className="mt-1 text-xs text-[var(--st-text-tertiary)]">{ip.isp}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-16">
                        <Progress value={ip.riskScore} tone={riskTone(ip.riskScore)} size="sm" aria-label={`Risk score ${ip.riskScore} of 100`} />
                      </div>
                      <span className="text-xs text-[var(--st-text-secondary)]">{ip.riskScore}/100</span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-sm text-[var(--st-text-secondary)]">{ip.lastSeen}</span>
                  </Td>
                  <Td>
                    <IpStatusBadge status={ip.status} />
                  </Td>
                  <Td align="right">
                    <Button variant="ghost" size="sm" onClick={() => toast.info(`Reviewing ${ip.address}`)}>
                      Review
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function CertificatesTab({ onOpenPreview }: { onOpenPreview: (cert: Certificate) => void }) {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <Card variant="outlined" padding="sm">
        <div className="flex items-center justify-between">
          <CardTitle>Certificates of Completion</CardTitle>
          <Button variant="primary" iconLeft={Plus} onClick={() => toast.success('Report generation started')}>
            Generate Report
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MOCK_CERTIFICATES.map((cert) => (
          <Card
            key={cert.id}
            variant="interactive"
            padding="md"
            className="flex h-full cursor-pointer flex-col"
            role="button"
            tabIndex={0}
            onClick={() => onOpenPreview(cert)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenPreview(cert);
              }
            }}
          >
            <div className="mb-4 flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]" aria-hidden="true">
                <FileBadge size={28} />
              </span>
              <Badge tone="success">{cert.status}</Badge>
            </div>

            <h4 className="mb-1 truncate font-medium text-[var(--st-text)]" title={cert.documentName}>{cert.documentName}</h4>
            <p className="mb-4 text-xs text-[var(--st-text-tertiary)]">{cert.size} • {cert.encryption}</p>

            <div className="mt-auto space-y-3">
              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3">
                <p className="mb-1 text-xs text-[var(--st-text-tertiary)]">Signers</p>
                <div className="flex flex-wrap gap-1">
                  {cert.signers.map((s, i) => (
                    <Badge key={i} tone="neutral">{s}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--st-text-tertiary)]">
                <span className="flex items-center gap-1">
                  <Calendar size={12} aria-hidden="true" /> {cert.completionDate}
                </span>
                <span className="font-[family-name:var(--st-font-mono)]" title={cert.blockchainTx}>{cert.blockchainTx.substring(0, 10)}...</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();

  const alerts = [
    { label: 'Multiple Failed Sign-ins', desc: 'Alert after 5 consecutive failures', on: true },
    { label: 'Unusual Geo-location', desc: 'Login from new country detected', on: true },
    { label: 'Mass Document Deletion', desc: 'Trigger on >10 deletions in 1hr', on: false },
  ];

  return (
    <Card variant="outlined" padding="lg">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]" aria-hidden="true">
          <Settings size={24} />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-[var(--st-text)]">Compliance &amp; Audit Settings</h2>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">Manage data retention, alerts, and export configurations for compliance audits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-medium text-[var(--st-text)]">
              <Database size={18} className="text-[var(--st-text-tertiary)]" aria-hidden="true" /> Data Retention Policy
            </h3>
            <Card variant="outlined" padding="md" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)]">Audit Log Retention</p>
                  <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">Duration to keep detailed logs</p>
                </div>
                <Field label="Audit log retention" className="w-44">
                  <Select defaultValue="7y">
                    <SelectTrigger aria-label="Audit log retention">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7y">7 Years (Default)</SelectItem>
                      <SelectItem value="10y">10 Years</SelectItem>
                      <SelectItem value="indef">Indefinite</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)]">Automated Archiving</p>
                  <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">Move old logs to cold storage</p>
                </div>
                <Switch defaultChecked aria-label="Automated archiving" />
              </div>
            </Card>
          </section>

          <section>
            <h3 className="mb-4 flex items-center gap-2 font-medium text-[var(--st-text)]">
              <Lock size={18} className="text-[var(--st-text-tertiary)]" aria-hidden="true" /> Cryptographic Anchoring
            </h3>
            <Card variant="outlined" padding="md" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)]">Blockchain Timestamping</p>
                  <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">Anchor hashes to public chains</p>
                </div>
                <Switch defaultChecked aria-label="Blockchain timestamping" />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-[var(--st-text-secondary)]">Network</p>
                  <p className="mt-1 text-xs text-[var(--st-text-tertiary)]">Target anchoring network</p>
                </div>
                <Field label="Anchoring network" className="w-44">
                  <Select defaultValue="eth">
                    <SelectTrigger aria-label="Anchoring network">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eth">Ethereum Mainnet</SelectItem>
                      <SelectItem value="polygon">Polygon POS</SelectItem>
                      <SelectItem value="btc">Bitcoin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="mb-4 flex items-center gap-2 font-medium text-[var(--st-text)]">
              <AlertTriangle size={18} className="text-[var(--st-text-tertiary)]" aria-hidden="true" /> Alert Triggers
            </h3>
            <Card variant="outlined" padding="md" className="space-y-4">
              {alerts.map((alert, idx) => (
                <React.Fragment key={alert.label}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-[var(--st-text-secondary)]">{alert.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--st-text-tertiary)]">{alert.desc}</p>
                    </div>
                    <Switch defaultChecked={alert.on} aria-label={alert.label} />
                  </div>
                  {idx < alerts.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </Card>
          </section>

          <Alert tone="info" icon={ShieldCheck} title="SOC 2 Compliance Mode Active">
            <p>
              Your current settings satisfy standard SOC 2 Type II compliance requirements for audit logging and non-repudiation.
            </p>
            <Button variant="ghost" size="sm" iconRight={ArrowRight} className="mt-3" onClick={() => toast.info('Opening compliance report')}>
              View Compliance Report
            </Button>
          </Alert>
        </div>
      </div>

      <Separator className="my-8" />
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={() => toast.info('Changes discarded')}>
          Discard Changes
        </Button>
        <Button variant="primary" onClick={() => toast.success('Settings saved')}>
          Save Settings
        </Button>
      </div>
    </Card>
  );
}

function CertificatePreviewBody({ cert }: { cert: Certificate }) {
  return (
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6 md:p-10">
      <div className="relative mx-auto max-w-3xl rounded-[var(--st-radius)] bg-[var(--st-bg)] p-10 shadow-[var(--st-shadow-md)]">
        <div className="mb-8 flex items-start justify-between border-b border-[var(--st-border)] pb-6">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--st-text)]">SabSign</h1>
            <p className="mt-1 text-sm uppercase tracking-widest text-[var(--st-text-tertiary)]">Certificate of Completion</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-[var(--st-text-secondary)]">Envelope ID:</p>
            <p className="font-[family-name:var(--st-font-mono)] text-xs text-[var(--st-text-tertiary)]">{cert.id}</p>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="mb-4 border-b border-[var(--st-border)] pb-2 text-lg font-semibold text-[var(--st-text)]">Document Information</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="font-medium text-[var(--st-text-tertiary)]">Document Name</p>
              <p className="font-semibold text-[var(--st-text)]">{cert.documentName}</p>
            </div>
            <div>
              <p className="font-medium text-[var(--st-text-tertiary)]">Completed On</p>
              <p className="font-semibold text-[var(--st-text)]">{cert.completionDate}</p>
            </div>
            <div>
              <p className="font-medium text-[var(--st-text-tertiary)]">Document Size</p>
              <p className="font-semibold text-[var(--st-text)]">{cert.size}</p>
            </div>
            <div>
              <p className="font-medium text-[var(--st-text-tertiary)]">Encryption</p>
              <p className="font-semibold text-[var(--st-text)]">{cert.encryption}</p>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="mb-4 border-b border-[var(--st-border)] pb-2 text-lg font-semibold text-[var(--st-text)]">Signatures</h3>
          <div className="space-y-6">
            {cert.signers.map((signer, index) => (
              <Card key={index} variant="outlined" padding="md">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[var(--st-text)]">{signer}</p>
                    <p className="text-xs text-[var(--st-text-tertiary)]">{signer.toLowerCase().replace(' ', '.')}@example.com</p>
                  </div>
                  <Badge tone="success"><CheckCircle size={12} aria-hidden="true" /> Verified</Badge>
                </div>

                <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[var(--st-text-tertiary)]">Signature Image</p>
                    <div className="flex h-12 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-2">
                      <span className="text-xl italic text-[var(--st-accent)]">{signer}</span>
                    </div>
                  </div>
                  <div className="space-y-2 font-[family-name:var(--st-font-mono)] text-[var(--st-text-secondary)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--st-text-tertiary)]">IP Address:</span>
                      <span>192.168.1.{Math.floor(Math.random() * 255)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--st-text-tertiary)]">Timestamp:</span>
                      <span>{new Date().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--st-text-tertiary)]">Authentication:</span>
                      <span>Email + SMS OTP</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 border-b border-[var(--st-border)] pb-2 text-lg font-semibold text-[var(--st-text)]">Cryptographic Proof</h3>
          <div className="break-all rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 font-[family-name:var(--st-font-mono)] text-xs">
            <p className="mb-1 text-[var(--st-text-tertiary)]">Document Hash (SHA-256)</p>
            <p className="mb-4 text-[var(--st-status-ok)]">{`0x${Array.from({ length: 64 }).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`}</p>
            <p className="mb-1 text-[var(--st-text-tertiary)]">Blockchain Transaction ID</p>
            <p className="text-[var(--st-accent)]">{cert.blockchainTx}</p>
          </div>

          <div className="mt-8 flex justify-center">
            <div className="text-center">
              <ShieldCheck size={48} className="mx-auto mb-2 text-[var(--st-status-ok)]" aria-hidden="true" />
              <p className="text-xs font-medium text-[var(--st-text-tertiary)]">SECURE NON-REPUDIATION GUARANTEED BY SABSIGN</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditTrailPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  return (
    <div className="20ui min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-3">
              <ShieldCheck className="text-[var(--st-accent)]" size={32} aria-hidden="true" />
              Audit Trail &amp; Compliance
            </PageTitle>
            <PageDescription>
              Cryptographically secure log of all system activities. Immutable records, network tracking, and verifiable certificates of completion.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Badge tone="success"><Dot tone="success" pulse /> System Normal</Badge>
            <IconButton label="Refresh audit data" icon={RefreshCw} variant="ghost" onClick={() => toast.success('Audit data refreshed')} />
          </PageActions>
        </PageHeader>

        <div className="mb-8 mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Audit Events" value="1.4M" icon={Activity} delta={{ value: '+12%', tone: 'up' }} />
          <StatCard label="Active Network IPs" value="842" icon={Server} delta={{ value: '-3%', tone: 'down' }} />
          <StatCard label="Security Alerts" value="14" icon={AlertTriangle} delta={{ value: '-24%', tone: 'down' }} />
          <StatCard label="Issued Certificates" value="12,405" icon={FileBadge} delta={{ value: '+8%', tone: 'up' }} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="timeline">
              <Clock size={16} aria-hidden="true" /> Timeline &amp; Events
            </TabsTrigger>
            <TabsTrigger value="network">
              <MapPin size={16} aria-hidden="true" /> Network &amp; IP Tracking
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <FileText size={16} aria-hidden="true" /> Certificates
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings size={16} aria-hidden="true" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-6">
            <TimelineTab />
          </TabsContent>
          <TabsContent value="network" className="mt-6">
            <NetworkTab />
          </TabsContent>
          <TabsContent value="certificates" className="mt-6">
            <CertificatesTab onOpenPreview={setSelectedCert} />
          </TabsContent>
          <TabsContent value="settings" className="mt-6">
            <SettingsTab />
          </TabsContent>
        </Tabs>
      </div>

      <Modal
        open={selectedCert != null}
        onClose={() => setSelectedCert(null)}
        title="Certificate of Completion"
        description={selectedCert?.id}
        size="lg"
        footer={
          <>
            <Button variant="outline" iconLeft={Printer} onClick={() => toast.info('Sending to printer')}>
              Print
            </Button>
            <Button variant="primary" iconLeft={Download} onClick={() => toast.success('Certificate downloaded')}>
              Download PDF
            </Button>
          </>
        }
      >
        {selectedCert ? <CertificatePreviewBody cert={selectedCert} /> : null}
      </Modal>
    </div>
  );
}
