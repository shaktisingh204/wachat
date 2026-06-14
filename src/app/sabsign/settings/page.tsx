"use client";

import React, { useState } from 'react';
import {
  Palette,
  Scale,
  ShieldCheck,
  Settings,
  UploadCloud,
  Save,
  AlertCircle,
  Globe,
  Eye,
  Key,
  Plus,
  Trash2,
  RefreshCw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Server,
  Activity,
  Shield,
  Network,
  Zap,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  CardBody,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
  Slider,
  ColorPicker,
  Badge,
  Progress,
  Separator,
  Alert,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFileUrlInput } from '@/components/sabfiles';

const tabs = [
  { id: 'general', name: 'General Settings', icon: Settings, description: 'Core application preferences' },
  { id: 'branding', name: 'Corporate Branding', icon: Palette, description: 'White-labeling and visual identity' },
  { id: 'legal', name: 'Legal and Disclosures', icon: Scale, description: 'Compliance texts and terms' },
  { id: 'security', name: 'Security and Auth', icon: ShieldCheck, description: 'Access control and policies' },
  { id: 'advanced', name: 'System Configs', icon: Server, description: 'Webhooks, APIs and integrations' },
];

// MOCK DATA
const initialIpWhitelist = [
  { id: 1, ip: '192.168.1.1', label: 'Corporate Office, NY', addedBy: 'admin@sabdesk.com', date: '2026-01-15' },
  { id: 2, ip: '10.0.0.55', label: 'VPN Gateway', addedBy: 'secops@sabdesk.com', date: '2026-02-22' },
  { id: 3, ip: '172.16.254.1', label: 'Remote Backup Server', addedBy: 'devops@sabdesk.com', date: '2026-03-10' },
];

const mockWebhooks = [
  { id: 1, url: 'https://api.acme.com/sabsign/events', events: ['envelope.signed', 'envelope.declined'], status: 'active', lastFired: '10 mins ago' },
  { id: 2, url: 'https://hooks.slack.com/services/invalid/webhook/placeholder', events: ['envelope.created'], status: 'failing', lastFired: '2 hrs ago' },
];

const featureToggles = [
  { title: 'Auto-Reminders', desc: "Automatically send email reminders to signers who haven't viewed documents." },
  { title: 'SMS Authentication', desc: 'Require recipients to enter a code sent via SMS before viewing.' },
  { title: 'Audit Trail Append', desc: 'Automatically append the PDF audit trail to the final signed document.' },
  { title: 'Block Disposable Emails', desc: 'Prevent envelopes from being sent to known disposable email providers.' },
];

const triggerBase =
  'flex w-full items-start gap-3 p-3 text-left whitespace-normal h-auto justify-start border rounded-[var(--st-radius)] transition-colors ' +
  'border-transparent text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] ' +
  'data-[state=active]:bg-[var(--st-accent-soft)] data-[state=active]:border-[var(--st-accent)] data-[state=active]:text-[var(--st-accent)]';

export default function SabSignSettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('branding');
  const [isSaving, setIsSaving] = useState(false);

  // Branding States
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#10b981');
  const [accentColor, setAccentColor] = useState('#f43f5e');
  const [buttonRadius, setButtonRadius] = useState(8);
  const [logoUrl, setLogoUrl] = useState('');

  // Legal States
  const [erisaText, setErisaText] = useState('In accordance with the Employee Retirement Income Security Act of 1974 (ERISA), the following disclosures apply to all benefits-related envelopes.');
  const [consentText, setConsentText] = useState('By checking this box, I legally consent to doing business electronically with SabSign Corporation and to receiving documents and disclosures in electronic form.');

  // Security States
  const [ipWhitelist] = useState(initialIpWhitelist);
  const [auditRetention, setAuditRetention] = useState(90);

  // Save Handler
  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Settings saved');
    }, 1500);
  };

  const TabIcon = tabs.find((t) => t.id === activeTab)?.icon || Settings;
  const activeName = tabs.find((t) => t.id === activeTab)?.name;
  const radiusValue = `${buttonRadius}px`;

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6 md:p-10">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-3">
              <Settings className="w-7 h-7 text-[var(--st-accent)]" aria-hidden="true" />
              SabSign Configurations
            </PageTitle>
            <PageDescription>
              Manage corporate branding, legal disclosures, security policies, and system settings.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="secondary" iconLeft={RefreshCw}>
              Reset Defaults
            </Button>
            <Button variant="primary" iconLeft={Save} loading={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </PageActions>
        </PageHeader>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation="vertical"
        className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start"
      >
        {/* Sidebar Navigation */}
        <aside className="lg:w-72 shrink-0 w-full">
          <Card variant="outlined" padding="sm" className="sticky top-6">
            <TabsList className="flex flex-col gap-1 w-full !shadow-none">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.id} value={tab.id} noPill className={triggerBase}>
                    <Icon
                      className="w-5 h-5 shrink-0 mt-0.5 text-[var(--st-text-tertiary)]"
                      aria-hidden="true"
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">{tab.name}</span>
                      <span className="text-xs text-[var(--st-text-tertiary)] mt-0.5">{tab.description}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <Card variant="outlined" padding="md" className="mt-8 bg-[var(--st-bg)]">
              <div className="flex items-center gap-2 text-[var(--st-accent)] mb-3">
                <Shield className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm font-medium">Compliance Status</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--st-text-secondary)]">SOC2 Type II</span>
                  <Badge tone="success" kind="soft" dot>
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--st-text-secondary)]">HIPAA BAA</span>
                  <Badge tone="warning" kind="soft" dot>
                    Pending
                  </Badge>
                </div>
                <Progress value={85} tone="accent" size="sm" aria-label="Compliance progress" className="mt-2" />
              </div>
            </Card>
          </Card>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 space-y-6">
          <Card variant="elevated" padding="lg">
            <CardBody>
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[var(--st-border)]">
                <span className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] flex items-center justify-center">
                  <TabIcon className="w-5 h-5 text-[var(--st-text)]" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-[var(--st-text)]">{activeName}</h2>
                  <p className="text-sm text-[var(--st-text-tertiary)]">
                    Configure settings specifically tailored for this module.
                  </p>
                </div>
              </div>

              {/* TAB: GENERAL SETTINGS */}
              <TabsContent value="general" className="space-y-8">
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Organization Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Company Legal Name">
                      <Input type="text" defaultValue="SabDesk Corporation" />
                    </Field>
                    <Field label="Primary Contact Email">
                      <Input type="email" defaultValue="legal@sabdesk.com" />
                    </Field>
                    <Field label="Support Phone Number">
                      <Input type="text" defaultValue="+1 (800) 555-0199" />
                    </Field>
                    <Field label="Headquarters Address">
                      <Input type="text" defaultValue="123 Signature Way, Suite 400, San Francisco, CA 94105" />
                    </Field>
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Localization and Formatting</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Default Timezone">
                      <Select defaultValue="pst">
                        <SelectTrigger aria-label="Default Timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pst">(UTC-08:00) Pacific Time (US and Canada)</SelectItem>
                          <SelectItem value="est">(UTC-05:00) Eastern Time (US and Canada)</SelectItem>
                          <SelectItem value="gmt">(UTC+00:00) Greenwich Mean Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Date Format">
                      <Select defaultValue="mdy">
                        <SelectTrigger aria-label="Date Format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Feature Toggles</h3>
                  <div className="space-y-4">
                    {featureToggles.map((feature, i) => (
                      <div
                        key={feature.title}
                        className="flex items-center justify-between p-4 rounded-[var(--st-radius)] bg-[var(--st-bg)] border border-[var(--st-border)]"
                      >
                        <div>
                          <div className="font-medium text-[var(--st-text)]">{feature.title}</div>
                          <div className="text-sm text-[var(--st-text-tertiary)]">{feature.desc}</div>
                        </div>
                        <Switch defaultChecked={i % 2 === 0} aria-label={feature.title} />
                      </div>
                    ))}
                  </div>
                </section>
              </TabsContent>

              {/* TAB: CORPORATE BRANDING */}
              <TabsContent value="branding" className="space-y-10">
                {/* Logo Upload Section */}
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4 flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                    Company Logo Assets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Primary Logo" help="SVG, PNG, or JPG. Max 5MB. Recommended size 400x120px.">
                      <SabFileUrlInput
                        value={logoUrl}
                        onChange={setLogoUrl}
                        accept="image"
                        pickerTitle="Select company logo"
                        placeholder="No logo chosen"
                      />
                    </Field>
                    <Card variant="outlined" padding="md" className="bg-[var(--st-bg)] flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--st-text)] mb-2">Current Logo</h4>
                        <div className="rounded-[var(--st-radius)] p-6 flex items-center justify-center h-32 border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                          <div className="flex items-center gap-3">
                            <span className="w-10 h-10 bg-[var(--st-accent)] rounded-[var(--st-radius)] flex items-center justify-center">
                              <Zap className="w-6 h-6 text-[var(--st-text-inverted)]" aria-hidden="true" />
                            </span>
                            <span className="text-2xl font-bold text-[var(--st-text)] tracking-tight">
                              Sab<span className="text-[var(--st-accent)]">Desk</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <Button variant="danger" iconLeft={Trash2}>
                          Remove
                        </Button>
                      </div>
                    </Card>
                  </div>
                </section>

                <Separator />

                {/* Color Scheme */}
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                    Color Palette
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Field label="Primary Brand Color" help="Used for primary buttons, highlights, and active states.">
                      <ColorPicker value={primaryColor} onChange={setPrimaryColor} />
                    </Field>
                    <Field label="Secondary Color" help="Used for success states, secondary buttons, and gradients.">
                      <ColorPicker value={secondaryColor} onChange={setSecondaryColor} />
                    </Field>
                    <Field label="Accent / Alert Color" help="Used for warnings, errors, and notifications.">
                      <ColorPicker value={accentColor} onChange={setAccentColor} />
                    </Field>
                  </div>
                </section>

                <Separator />

                {/* Typography and Styling */}
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Typography and UI Elements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Heading Font Family">
                      <Select defaultValue="inter">
                        <SelectTrigger aria-label="Heading Font Family">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inter">Inter (Default)</SelectItem>
                          <SelectItem value="roboto">Roboto</SelectItem>
                          <SelectItem value="poppins">Poppins</SelectItem>
                          <SelectItem value="opensans">Open Sans</SelectItem>
                          <SelectItem value="custom">Custom Web Font</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Button and Card Border Radius">
                      <div className="flex items-center gap-4">
                        <Slider
                          min={0}
                          max={24}
                          value={buttonRadius}
                          onValueChange={(v) => setButtonRadius(Array.isArray(v) ? v[0] : v)}
                          ariaLabel="Button and card border radius"
                          className="flex-1"
                        />
                        <span className="text-sm font-mono text-[var(--st-text)] w-12 text-right">{radiusValue}</span>
                      </div>
                    </Field>
                  </div>
                </section>

                {/* Live Preview Pane */}
                <Card variant="outlined" padding="lg" className="bg-[var(--st-bg)] relative overflow-hidden">
                  <div className="absolute top-0 right-0">
                    <Badge tone="accent" kind="solid" className="rounded-none rounded-bl-[var(--st-radius)]">
                      Live Preview
                    </Badge>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--st-text-secondary)] mb-6">Component Preview</h4>

                  <div className="flex flex-col md:flex-row gap-8 items-center justify-center bg-[var(--st-bg-secondary)] p-8 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                    {/* Display-only preview of the user-picked brand colors (not real controls). */}
                    <div
                      role="presentation"
                      className="px-6 py-3 text-white font-medium transition-transform hover:-translate-y-1"
                      style={{ backgroundColor: primaryColor, borderRadius: radiusValue, boxShadow: `0 4px 14px 0 ${primaryColor}40` }}
                    >
                      Primary Action
                    </div>

                    <div
                      role="presentation"
                      className="px-6 py-3 font-medium transition-transform hover:-translate-y-1 border-2"
                      style={{ borderColor: secondaryColor, color: secondaryColor, borderRadius: radiusValue }}
                    >
                      Secondary Action
                    </div>

                    <div
                      role="presentation"
                      className="flex items-center gap-2 px-4 py-2"
                      style={{ color: accentColor, backgroundColor: `${accentColor}1a`, borderRadius: radiusValue }}
                    >
                      <AlertCircle className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">Destructive Action</span>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* TAB: LEGAL AND DISCLOSURES */}
              <TabsContent value="legal" className="space-y-8">
                <Alert tone="warning" title="Legal Review Recommended">
                  Changes to electronic signature consent or ERISA disclosures may have legal implications. Please
                  consult with your legal department before publishing changes.
                </Alert>

                {/* Rich Text Editor Mock, Electronic Consent */}
                <section className="space-y-3">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--st-text)]">
                      Electronic Signature Consent (ESIGN Act)
                    </h3>
                    <p className="text-sm text-[var(--st-text-tertiary)] mt-1">
                      This text is displayed to signers before they can view documents.
                    </p>
                  </div>

                  <Card variant="outlined" padding="none" className="overflow-hidden bg-[var(--st-bg)]">
                    <div className="bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] p-2 flex items-center gap-1 flex-wrap">
                      <IconButton label="Bold" icon={Bold} size="sm" />
                      <IconButton label="Italic" icon={Italic} size="sm" />
                      <IconButton label="Underline" icon={Underline} size="sm" />
                      <Separator orientation="vertical" className="mx-1 h-4" />
                      <IconButton label="Align left" icon={AlignLeft} size="sm" />
                      <IconButton label="Align center" icon={AlignCenter} size="sm" />
                      <IconButton label="Align right" icon={AlignRight} size="sm" />
                      <Separator orientation="vertical" className="mx-1 h-4" />
                      <Button variant="ghost" size="sm">
                        H1
                      </Button>
                      <Button variant="ghost" size="sm">
                        H2
                      </Button>
                    </div>
                    <Field label="Electronic signature consent text" className="[&>label]:sr-only">
                      <Textarea
                        value={consentText}
                        onChange={(e) => setConsentText(e.target.value)}
                        rows={6}
                        className="rounded-none border-0"
                      />
                    </Field>
                    <div className="bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)] p-2 text-xs text-[var(--st-text-tertiary)] text-right">
                      {consentText.length} characters
                    </div>
                  </Card>
                </section>

                <Separator />

                {/* ERISA Disclosures */}
                <section className="space-y-3">
                  <Field label="ERISA and 401(k) Disclosures" help="Specific compliance text required for HR and Benefits envelopes.">
                    <Textarea value={erisaText} onChange={(e) => setErisaText(e.target.value)} rows={5} />
                  </Field>
                </section>

                <Separator />

                {/* Privacy Policy and TOS Links */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Terms of Service URL">
                    <Input type="url" defaultValue="https://sabdesk.com/terms" iconLeft={Globe} />
                  </Field>
                  <Field label="Privacy Policy URL">
                    <Input type="url" defaultValue="https://sabdesk.com/privacy" iconLeft={Shield} />
                  </Field>
                </section>
              </TabsContent>

              {/* TAB: SECURITY AND COMPLIANCE */}
              <TabsContent value="security" className="space-y-8">
                {/* Auth Policies */}
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Authentication Policies</h3>

                  <Card variant="outlined" padding="lg" className="bg-[var(--st-bg)] space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-[var(--st-text)]">
                          Require Two-Factor Authentication (2FA)
                        </div>
                        <div className="text-sm text-[var(--st-text-tertiary)]">
                          Enforce 2FA for all administrative accounts accessing SabSign settings.
                        </div>
                      </div>
                      <Switch defaultChecked aria-label="Require Two-Factor Authentication" />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Field label="Idle Session Timeout (Minutes)">
                        <Select defaultValue="15">
                          <SelectTrigger aria-label="Idle Session Timeout">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 Minutes</SelectItem>
                            <SelectItem value="30">30 Minutes</SelectItem>
                            <SelectItem value="60">60 Minutes</SelectItem>
                            <SelectItem value="120">120 Minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Password Expiration (Days)">
                        <Select defaultValue="30">
                          <SelectTrigger aria-label="Password Expiration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 Days</SelectItem>
                            <SelectItem value="60">60 Days</SelectItem>
                            <SelectItem value="90">90 Days</SelectItem>
                            <SelectItem value="never">Never (Not Recommended)</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </Card>
                </section>

                {/* IP Whitelisting */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-[var(--st-text)] flex items-center gap-2">
                      <Network className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                      IP Address Whitelist
                    </h3>
                    <Button variant="ghost" size="sm" iconLeft={Plus}>
                      Add IP Address
                    </Button>
                  </div>

                  <Card variant="outlined" padding="none" className="overflow-hidden">
                    <Table>
                      <THead>
                        <Tr>
                          <Th>IP Address / CIDR</Th>
                          <Th>Label</Th>
                          <Th>Added By</Th>
                          <Th align="right">Actions</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {ipWhitelist.map((ip) => (
                          <Tr key={ip.id}>
                            <Td className="font-mono">{ip.ip}</Td>
                            <Td>{ip.label}</Td>
                            <Td className="text-xs">{ip.addedBy}</Td>
                            <Td align="right">
                              <IconButton label={`Remove ${ip.ip}`} icon={Trash2} size="sm" variant="ghost" />
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </Card>
                </section>

                {/* Audit Logs */}
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Audit Log Retention</h3>
                  <Card variant="outlined" padding="lg" className="bg-[var(--st-bg)]">
                    <p className="text-sm text-[var(--st-text-secondary)] mb-4">
                      Select how long detailed security and access audit logs should be retained in the system before
                      being archived to cold storage.
                    </p>
                    <div className="flex items-center gap-4">
                      <Slider
                        min={30}
                        max={365}
                        value={auditRetention}
                        onValueChange={(v) => setAuditRetention(Array.isArray(v) ? v[0] : v)}
                        ariaLabel="Audit log retention in days"
                        className="flex-1"
                      />
                      <Badge tone="neutral" kind="outline" className="font-mono">
                        {auditRetention} Days
                      </Badge>
                    </div>
                  </Card>
                </section>
              </TabsContent>

              {/* TAB: ADVANCED CONFIGURATIONS */}
              <TabsContent value="advanced" className="space-y-8">
                {/* API Keys */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-[var(--st-text)] flex items-center gap-2">
                        <Key className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                        API Keys
                      </h3>
                      <p className="text-sm text-[var(--st-text-tertiary)] mt-1">
                        Manage API keys for programmatic access to SabSign.
                      </p>
                    </div>
                    <Button variant="outline">Generate New Key</Button>
                  </div>

                  <Card variant="outlined" padding="md" className="bg-[var(--st-bg)]">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[var(--st-border)]">
                      <div>
                        <div className="font-medium text-[var(--st-text)]">Production Integration Key</div>
                        <div className="text-xs text-[var(--st-text-tertiary)] mt-1">
                          Created on Jan 12, 2026. Last used 5 mins ago.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-3 py-1.5 rounded-[var(--st-radius)] font-mono text-xs text-[var(--st-text-secondary)] flex items-center gap-2">
                          sk_prod_••••••••••••••••••••8f2a
                          <IconButton label="Reveal production key" icon={Eye} size="sm" variant="ghost" />
                        </span>
                        <Button variant="danger" size="sm">
                          Revoke
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4">
                      <div>
                        <div className="font-medium text-[var(--st-text)]">Staging Environment</div>
                        <div className="text-xs text-[var(--st-text-tertiary)] mt-1">Created on Feb 22, 2026. Never used.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--st-bg-secondary)] border border-[var(--st-border)] px-3 py-1.5 rounded-[var(--st-radius)] font-mono text-xs text-[var(--st-text-secondary)] flex items-center gap-2">
                          sk_test_••••••••••••••••••••3b9c
                          <IconButton label="Reveal staging key" icon={Eye} size="sm" variant="ghost" />
                        </span>
                        <Button variant="danger" size="sm">
                          Revoke
                        </Button>
                      </div>
                    </div>
                  </Card>
                </section>

                {/* Webhooks */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-[var(--st-text)] flex items-center gap-2">
                      <Activity className="w-5 h-5 text-[var(--st-accent)]" aria-hidden="true" />
                      Webhook Endpoints
                    </h3>
                    <Button variant="ghost" size="sm" iconLeft={Plus}>
                      Add Endpoint
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {mockWebhooks.map((hook) => (
                      <Card
                        key={hook.id}
                        variant="outlined"
                        padding="md"
                        className="bg-[var(--st-bg)] flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center"
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge tone={hook.status === 'active' ? 'success' : 'danger'} kind="soft" dot>
                              {hook.status === 'active' ? 'Active' : 'Failing'}
                            </Badge>
                            <span className="font-mono text-sm text-[var(--st-text-secondary)] break-all">{hook.url}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {hook.events.map((ev) => (
                              <Badge key={ev} tone="neutral" kind="outline">
                                {ev}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between w-full lg:w-auto gap-2">
                          <div className="text-xs text-[var(--st-text-tertiary)]">Last fired: {hook.lastFired}</div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm">
                              Test
                            </Button>
                            <Button variant="danger" size="sm">
                              Delete
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>

                {/* SSO Configuration */}
                <section>
                  <h3 className="text-lg font-medium text-[var(--st-text)] mb-4">Single Sign-On (SSO)</h3>
                  <Card variant="outlined" padding="none" className="bg-[var(--st-bg)] overflow-hidden">
                    <div className="p-5 border-b border-[var(--st-border)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-[var(--st-text)]">SAML 2.0 Integration</div>
                          <div className="text-sm text-[var(--st-text-tertiary)] mt-1">
                            Allow users to log in using Okta, Azure AD, or other SAML providers.
                          </div>
                        </div>
                        <Button variant="secondary">Configure</Button>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-[var(--st-text)]">OAuth / Social Login</div>
                          <div className="text-sm text-[var(--st-text-tertiary)] mt-1">
                            Enable login via Google Workspace or Microsoft 365.
                          </div>
                        </div>
                        <Switch aria-label="Enable OAuth social login" />
                      </div>
                    </div>
                  </Card>
                </section>
              </TabsContent>
            </CardBody>
          </Card>
        </main>
      </Tabs>
    </div>
  );
}
