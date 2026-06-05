'use client';

/**
 * /sabcrm/20ui — the 20ui design-system showcase.
 *
 * A living gallery of every 20ui component and its variants, rendered inside the
 * `.sabcrm-twenty` scope so it shows the real tokens. Demo data is realistic
 * (taste rule: no "Jane Doe" / "Acme"); no em-dashes in visible copy.
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
} from '@/components/sabcrm/20ui';

import './showcase.css';

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

export default function TwentyUiShowcase(): React.JSX.Element {
  const [switchOn, setSwitchOn] = React.useState(true);
  const [seg, setSeg] = React.useState('table');
  const [tab, setTab] = React.useState('overview');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [agree, setAgree] = React.useState(true);
  const [plan, setPlan] = React.useState('growth');

  return (
    <div className="ux-page">
      <header className="ux-hero">
        <Breadcrumb
          items={[{ label: 'SabCRM', href: '/sabcrm' }, { label: '20ui' }]}
        />
        <h1 style={{ marginTop: 12 }}>20ui</h1>
        <p>
          SabCRM&apos;s design system. Twenty as the foundation, refined into a
          modern, minimal, accessible component set. Every control below is
          keyboard operable, respects reduced motion, and meets AA contrast.
        </p>
      </header>

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
  );
}
