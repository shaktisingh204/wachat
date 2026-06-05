'use client';

/**
 * Ui20Showcase — the shared 20ui design-system gallery.
 *
 * Every 20ui component and its variants. Rendered at /sabcrm/20ui (inside the
 * CRM) and /demo20 (standalone, app-wide). Its root carries the `ui20` class so
 * it resolves the system's own tokens in either context. Demo data is realistic;
 * no em-dashes in visible copy.
 */

import * as React from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Inbox,
  ChevronDown,
  Mail,
  Phone,
  Sparkles,
  Zap,
  ArrowRight,
  Workflow,
  BarChart3,
  MessageSquare,
  Filter,
  CalendarDays,
  Settings,
  Bell,
  Rocket,
  Gauge,
} from 'lucide-react';

import {
  Button,
  IconButton,
  ButtonGroup,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  StatCard,
  MediaCard,
  Badge,
  Tag,
  Dot,
  Field,
  Input,
  Textarea,
  Switch,
  Checkbox,
  Radio,
  RadioGroup,
  SegmentedControl,
  Tabs,
  Alert,
  Callout,
  EmptyState,
  Skeleton,
  Spinner,
  Progress,
  ProgressRing,
  Tooltip,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuLabel,
  Modal,
  Separator,
  Kbd,
  Breadcrumb,
  Avatar,
  AvatarGroup,
  GradientText,
  GradientIcon,
  GlassPill,
  Aurora,
  SpotlightCard,
  FeatureTile,
  GlowBadge,
  Select,
  Combobox,
  Slider,
  Pagination,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  ToastProvider,
  Toaster,
  useToast,
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  DatePicker,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  DataTable,
  type DataTableColumn,
  RadioCardGroup,
  RadioCard,
  Rating,
  OtpInput,
  SearchInput,
} from '@/components/sabcrm/20ui';

import './ui20-showcase.css';

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ux-section">
      <div className="ux-section__head">
        <h2>{title}</h2>
        {note ? <span>{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Ui20Showcase(): React.JSX.Element {
  const [switchOn, setSwitchOn] = React.useState(true);
  const [seg, setSeg] = React.useState('table');
  const [tab, setTab] = React.useState('overview');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [agree, setAgree] = React.useState(true);
  const [plan, setPlan] = React.useState('growth');
  const [stage, setStage] = React.useState<string | null>('proposal');
  const [city, setCity] = React.useState<string | null>(null);
  const [budget, setBudget] = React.useState<number | number[]>(60);
  const [page, setPage] = React.useState(3);
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [otp, setOtp] = React.useState('');
  const [stars, setStars] = React.useState(4);
  const [search, setSearch] = React.useState('');
  const [size, setSize] = React.useState('growth');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);

  return (
    <ToastProvider>
    <div className="ui20 ux-page">
      <Breadcrumb
        items={[{ label: 'SabCRM', href: '/sabcrm' }, { label: '20ui' }]}
      />

      <Aurora intensity="normal" className="ux-aurora-hero">
        <GlassPill icon={Sparkles}>Design system</GlassPill>
        <h1 className="ux-hero-title">
          <GradientText tone="brand" underline>
            20ui
          </GradientText>{' '}
          components, built for SabCRM.
        </h1>
        <p className="ux-hero-sub">
          Twenty as the foundation, elevated with the SabNode brand language.
          Every control is keyboard operable, respects reduced motion, and meets
          AA contrast. Premium where it counts, calm everywhere else.
        </p>
        <div className="ux-row" style={{ marginTop: 4 }}>
          <Button variant="gradient" iconRight={ArrowRight}>
            Get started
          </Button>
          <Button variant="ghost">Browse components</Button>
        </div>
      </Aurora>

      {/* PREMIUM */}
      <Section title="Premium" note="landing-inspired · opt-in flourishes">
        <div className="ux-row">
          <Button variant="gradient" iconLeft={Sparkles}>Upgrade to Pro</Button>
          <GlowBadge tone="brand" icon={Zap}>New</GlowBadge>
          <GlowBadge tone="violet">Beta</GlowBadge>
          <GradientText tone="brand" style={{ fontSize: 18 }}>Amber to rose</GradientText>
          <GradientText tone="violet" style={{ fontSize: 18 }}>Violet</GradientText>
          <GradientText tone="sky" style={{ fontSize: 18 }}>Sky</GradientText>
        </div>
        <div className="ux-grid" style={{ marginTop: 12 }}>
          <FeatureTile
            icon={MessageSquare}
            tone="emerald"
            title="Conversations"
            description="Unified WhatsApp, chat, and email in one timeline."
            trailing={<GlowBadge tone="emerald">Live</GlowBadge>}
          />
          <FeatureTile
            icon={Workflow}
            tone="violet"
            title="Automations"
            description="Visual flows that move records the moment things change."
          />
          <FeatureTile
            icon={BarChart3}
            tone="sky"
            title="Insights"
            description="Pipeline, velocity, and win-rate, refreshed in real time."
          />
        </div>
        <div className="ux-grid" style={{ marginTop: 12 }}>
          <SpotlightCard tone="brand">
            <div className="ux-row" style={{ margin: 0 }}>
              <GradientIcon icon={Sparkles} tone="brand" />
              <div>
                <div style={{ fontWeight: 600 }}>Spotlight card</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-secondary)' }}>
                  The glow follows your cursor.
                </div>
              </div>
            </div>
          </SpotlightCard>
          <SpotlightCard tone="rose">
            <div className="ux-row" style={{ margin: 0 }}>
              <GradientIcon icon={TrendingUp} tone="rose" />
              <div>
                <div style={{ fontWeight: 600 }}>$486,200 pipeline</div>
                <div style={{ fontSize: 12, color: 'var(--st-text-secondary)' }}>
                  +12.4% month over month.
                </div>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </Section>

      {/* BUTTONS */}
      <Section title="Buttons" note="variants · sizes · icon · loading">
        <div className="ux-row">
          <Button variant="primary" iconLeft={Plus}>
            New lead
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" iconLeft={Trash2}>
            Delete
          </Button>
          <Button variant="primary" loading>
            Saving
          </Button>
        </div>
        <div className="ux-row">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <ButtonGroup>
            <Button>Day</Button>
            <Button>Week</Button>
            <Button>Month</Button>
          </ButtonGroup>
          <Tooltip label="Filter records">
            <IconButton label="Filter" icon={Search} />
          </Tooltip>
        </div>
      </Section>

      {/* CARDS */}
      <Section title="Cards" note="elevated · outlined · interactive · stat · media">
        <div className="ux-grid">
          <StatCard
            label="Open pipeline"
            value="$486,200"
            icon={DollarSign}
            accent="#3b7af5"
            delta={{ value: '+12.4% MoM', tone: 'up' }}
          />
          <StatCard
            label="New contacts"
            value="1,284"
            icon={Users}
            accent="#1f9d55"
            delta={{ value: '+38 this week', tone: 'up' }}
          />
          <StatCard
            label="Win rate"
            value="27.6%"
            icon={TrendingUp}
            accent="#7c3aed"
            delta={{ value: '-1.2 pts', tone: 'down' }}
          />
        </div>
        <div className="ux-grid" style={{ marginTop: 12 }}>
          <Card variant="elevated">
            <CardHeader>
              <div>
                <CardTitle>Northwind Trading</CardTitle>
                <CardDescription>Wholesale distribution, Pune</CardDescription>
              </div>
              <Badge tone="success">Customer</Badge>
            </CardHeader>
            <CardBody>
              <div className="ux-row" style={{ margin: 0 }}>
                <Tag color="#3b7af5">Priority</Tag>
                <Tag color="#1f9d55">Renewal</Tag>
              </div>
            </CardBody>
            <CardFooter>
              <Avatar name="Aanya Sharma" shape="round" size="sm" />
              <span style={{ fontSize: 12, color: 'var(--st-text-secondary)' }}>
                Owned by Aanya Sharma
              </span>
            </CardFooter>
          </Card>

          <Card variant="interactive" role="button" tabIndex={0}>
            <CardTitle>Interactive card</CardTitle>
            <CardDescription>
              Hovers lift and presses settle. Use for clickable records.
            </CardDescription>
          </Card>

          <MediaCard
            media={<div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#3b7af5,#7c3aed)' }} />}
            title="Q3 campaign brief"
            description="Lifecycle email series for trial accounts."
            footer={<Badge tone="info" dot>Draft</Badge>}
          />
        </div>
      </Section>

      {/* BADGES / TAGS */}
      <Section title="Badges, tags, status" note="tones × soft / solid / outline">
        <div className="ux-row">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="info">Info</Badge>
        </div>
        <div className="ux-row">
          <Badge tone="accent" kind="solid">Solid</Badge>
          <Badge tone="success" kind="outline">Outline</Badge>
          <Badge tone="danger" kind="soft" dot>With dot</Badge>
          <Tag color="#e0484e" onRemove={() => undefined}>Removable</Tag>
          <span className="ux-row" style={{ margin: 0, gap: 6 }}>
            <Dot tone="success" pulse /> <span style={{ fontSize: 12 }}>Live</span>
          </span>
        </div>
      </Section>

      {/* FORMS */}
      <Section title="Forms" note="label above · helper + error below · auto-wired a11y">
        <div className="ux-col">
          <Field label="Company name" required help="The legal entity name.">
            <Input placeholder="Northwind Trading" />
          </Field>
          <Field label="Website">
            <Input prefix="https://" placeholder="northwind.example" />
          </Field>
          <Field label="Work email" error="Enter a valid email address.">
            <Input iconLeft={Mail} defaultValue="aanya@" />
          </Field>
          <Field label="Notes" help="Visible to your team only.">
            <Textarea placeholder="Add context for this account" />
          </Field>
        </div>
      </Section>

      {/* CHOICE */}
      <Section title="Choice controls" note="switch · checkbox · radio">
        <div className="ux-row">
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} label="Email notifications" />
          <Checkbox checked={agree} onChange={(e) => setAgree(e.currentTarget.checked)} label="Subscribe to product updates" />
        </div>
        <RadioGroup value={plan} onValueChange={setPlan} aria-label="Plan">
          <Radio value="starter" label="Starter" />
          <Radio value="growth" label="Growth" />
          <Radio value="scale" label="Scale" />
        </RadioGroup>
      </Section>

      {/* SEGMENTED / TABS */}
      <Section title="Segmented & tabs" note="sliding indicator · keyboard nav">
        <div className="ux-row">
          <SegmentedControl
            aria-label="View"
            value={seg}
            onChange={setSeg}
            items={[
              { value: 'table', label: 'Table' },
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Calendar' },
            ]}
          />
        </div>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'activity', label: 'Activity', badge: 12 },
            { value: 'files', label: 'Files' },
            { value: 'settings', label: 'Settings', disabled: true },
          ]}
        />
      </Section>

      {/* FEEDBACK */}
      <Section title="Feedback" note="alert · callout · empty state">
        <div className="ux-col" style={{ maxWidth: 560 }}>
          <Alert tone="success" title="Import complete">
            842 contacts were added to Growth pipeline.
          </Alert>
          <Alert tone="warning" title="Sync delayed" onClose={() => undefined}>
            The last sync ran 26 minutes ago.
          </Alert>
          <Alert tone="danger" title="Card declined">
            Update the billing method to keep automations running.
          </Alert>
          <Callout tone="info" title="Tip">
            Press <Kbd>C</Kbd> on any list to create a record.
          </Callout>
        </div>
        <div style={{ marginTop: 16, maxWidth: 560 }}>
          <Card variant="outlined">
            <EmptyState
              icon={Inbox}
              title="No leads yet"
              description="Create your first lead or import a list to get started."
              action={<Button variant="primary" iconLeft={Plus}>New lead</Button>}
            />
          </Card>
        </div>
      </Section>

      {/* LOADING */}
      <Section title="Loading & progress" note="skeleton · spinner · progress">
        <div className="ux-row">
          <Spinner />
          <ProgressRing value={68} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 240 }}>
            <Progress value={72} tone="accent" />
            <Progress value={46} tone="success" />
            <Progress indeterminate />
          </div>
        </div>
        <Card variant="outlined" style={{ maxWidth: 360, marginTop: 12 }}>
          <div className="ux-row" style={{ margin: 0 }}>
            <Skeleton circle width={36} height={36} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Skeleton width="60%" height={12} />
              <Skeleton width="90%" height={12} />
            </div>
          </div>
        </Card>
      </Section>

      {/* OVERLAYS */}
      <Section title="Overlays" note="tooltip · menu · modal">
        <div className="ux-row">
          <Menu
            label="Record actions"
            trigger={<Button variant="secondary" iconRight={ChevronDown}>Actions</Button>}
          >
            <MenuLabel>Record</MenuLabel>
            <MenuItem icon={Pencil} onSelect={() => undefined}>Edit</MenuItem>
            <MenuItem icon={Copy} onSelect={() => undefined} hint="⌘D">Duplicate</MenuItem>
            <MenuSeparator />
            <MenuItem icon={Trash2} danger onSelect={() => undefined}>Delete</MenuItem>
          </Menu>

          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>

          <Tooltip label="Call this contact">
            <IconButton label="Call" icon={Phone} variant="secondary" />
          </Tooltip>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Create company"
          description="Add a new company to this workspace."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Create company
              </Button>
            </>
          }
        >
          <div className="ux-col" style={{ maxWidth: 'none' }}>
            <Field label="Name" required>
              <Input iconLeft={Building2} placeholder="Lumen Health" autoFocus />
            </Field>
            <Field label="Industry">
              <Input placeholder="Healthcare" />
            </Field>
          </div>
        </Modal>
      </Section>

      {/* AVATARS */}
      <Section title="Avatars" note="colourful initials · group overflow">
        <div className="ux-row">
          <Avatar name="Aanya Sharma" shape="round" size="lg" />
          <Avatar name="Rohan Mehta" shape="round" />
          <Avatar name="Lumen Health" shape="square" />
          <AvatarGroup max={4} size="md" label="Account team">
            <Avatar name="Aanya Sharma" />
            <Avatar name="Rohan Mehta" />
            <Avatar name="Diego Alvarez" />
            <Avatar name="Mei Lin" />
            <Avatar name="Priya Nair" />
            <Avatar name="Sam Okoye" />
          </AvatarGroup>
        </div>
      </Section>

      {/* SELECTS */}
      <Section title="Selects & search" note="select · combobox · search · slider">
        <div className="ux-grid">
          <Field label="Stage">
            <Select
              value={stage}
              onChange={setStage}
              placeholder="Select stage"
              options={[
                { value: 'new', label: 'New' },
                { value: 'screening', label: 'Screening' },
                { value: 'meeting', label: 'Meeting' },
                { value: 'proposal', label: 'Proposal' },
                { value: 'customer', label: 'Customer' },
              ]}
            />
          </Field>
          <Field label="City">
            <Combobox
              value={city}
              onChange={(v) => setCity(v)}
              placeholder="Search a city"
              options={[
                { value: 'pune', label: 'Pune' },
                { value: 'mumbai', label: 'Mumbai' },
                { value: 'bengaluru', label: 'Bengaluru' },
                { value: 'delhi', label: 'New Delhi' },
                { value: 'lisbon', label: 'Lisbon' },
              ]}
            />
          </Field>
          <Field label="Search">
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search records"
              shortcut="⌘K"
            />
          </Field>
        </div>
        <div style={{ maxWidth: 360, marginTop: 16 }}>
          <Field label="Budget">
            <Slider value={budget} onValueChange={setBudget} min={0} max={100} showValue />
          </Field>
        </div>
      </Section>

      {/* DISCLOSURE + POPOVER */}
      <Section title="Disclosure & popovers" note="accordion · popover · drawer · command">
        <div className="ux-col" style={{ maxWidth: 560 }}>
          <Accordion type="single" collapsible defaultValue="a1">
            <AccordionItem value="a1">
              <AccordionTrigger>What is 20ui?</AccordionTrigger>
              <AccordionContent>
                SabNode&apos;s standalone design system, built to be advanced, minimal,
                and accessible by default.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="a2">
              <AccordionTrigger>Does it work app-wide?</AccordionTrigger>
              <AccordionContent>
                Yes. Wrap any subtree in a `ui20` class and every component renders
                with its own self-contained tokens.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div className="ux-row" style={{ marginTop: 16 }}>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" iconLeft={Filter}>Filter</Button>
            </PopoverTrigger>
            <PopoverContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Filter leads</span>
                <RadioCardGroup value={size} onChange={setSize} label="Deal size">
                  <RadioCard value="growth" label="Growth" description="Mid-market" icon={Gauge} />
                  <RadioCard value="enterprise" label="Enterprise" description="500+ seats" icon={Rocket} />
                </RadioCardGroup>
              </div>
            </PopoverContent>
          </Popover>

          <Drawer side="right">
            <DrawerTrigger asChild>
              <Button variant="secondary" iconLeft={Settings}>Open drawer</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Settings</DrawerTitle>
                <DrawerDescription>A side panel for detail + edit flows.</DrawerDescription>
              </DrawerHeader>
              <div>
                <Field label="Workspace name">
                  <Input placeholder="Acme" />
                </Field>
              </div>
              <DrawerFooter>
                <DrawerClose asChild><Button variant="secondary">Cancel</Button></DrawerClose>
                <Button variant="primary">Save</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          <Button variant="secondary" iconLeft={Sparkles} onClick={() => setCmdOpen(true)}>
            Command menu
          </Button>
          <ToastDemo />
        </div>

        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen} label="Command menu">
          <CommandInput placeholder="Type a command or search" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem>New lead<CommandShortcut>⌘N</CommandShortcut></CommandItem>
              <CommandItem>New company</CommandItem>
              <CommandItem>Search records<CommandShortcut>⌘K</CommandShortcut></CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </Section>

      {/* DATA */}
      <Section title="Data" note="data table · pagination · date · rating · otp">
        <DataTable
          columns={
            [
              { key: 'name', header: 'Company', sortable: true },
              { key: 'stage', header: 'Stage', render: (r) => <Badge tone="info">{r.stage}</Badge> },
              { key: 'amount', header: 'Amount', align: 'right', sortable: true },
            ] as DataTableColumn<{ id: string; name: string; stage: string; amount: string }>[]
          }
          rows={[
            { id: '1', name: 'Northwind Trading', stage: 'Proposal', amount: '$48,200' },
            { id: '2', name: 'Lumen Health', stage: 'Meeting', amount: '$31,900' },
            { id: '3', name: 'Atlas Robotics', stage: 'Customer', amount: '$120,400' },
          ]}
          getRowId={(r) => r.id}
          hover
        />
        <div className="ux-row" style={{ marginTop: 16 }}>
          <Pagination page={page} pageCount={12} onPageChange={setPage} />
        </div>
        <div className="ux-grid" style={{ marginTop: 16 }}>
          <Field label="Close date">
            <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
          </Field>
          <Field label="Rating">
            <Rating value={stars} onChange={setStars} label="Deal confidence" />
          </Field>
          <Field label="Verification code">
            <OtpInput value={otp} onChange={setOtp} length={6} />
          </Field>
        </div>
      </Section>

      {/* PRIMITIVE TABLE */}
      <Section title="Table primitives" note="composable Table">
        <Table>
          <THead>
            <Tr><Th>Owner</Th><Th>Role</Th><Th align="right">Deals</Th></Tr>
          </THead>
          <TBody>
            <Tr><Td>Aanya Sharma</Td><Td>Account Executive</Td><Td align="right">14</Td></Tr>
            <Tr><Td>Rohan Mehta</Td><Td>SDR</Td><Td align="right">9</Td></Tr>
          </TBody>
        </Table>
      </Section>

      {/* MISC */}
      <Section title="Misc" note="separator · kbd · breadcrumb">
        <div className="ux-row">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
          <Separator orientation="vertical" style={{ height: 20 }} />
          <span style={{ fontSize: 12, color: 'var(--st-text-secondary)' }}>
            Open the command menu
          </span>
        </div>
        <Separator label="Section" />
      </Section>
    </div>
    <Toaster />
    </ToastProvider>
  );
}

/** Small demo that uses the toast hook (must live inside ToastProvider). */
function ToastDemo(): React.JSX.Element {
  const { toast } = useToast();
  return (
    <Button
      variant="secondary"
      iconLeft={Bell}
      onClick={() =>
        toast({
          tone: 'success',
          title: 'Lead created',
          description: 'Northwind Trading was added to Growth.',
          action: { label: 'View', onClick: () => undefined },
        })
      }
    >
      Show toast
    </Button>
  );
}
