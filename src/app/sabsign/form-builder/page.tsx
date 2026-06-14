'use client';

import React, { useState } from 'react';
import {
  Plus, MoreVertical, Settings, ArrowLeft,
  Type, AlignLeft, CheckSquare, List,
  Calendar, Hash, ChevronUp, ChevronDown,
  Copy, Trash2,
  Eye, Send, Undo, Redo, ZoomIn, ZoomOut,
  MousePointer2, Hand, X, PenTool, LayoutTemplate,
  Users, Briefcase, FileSignature, Layers, ShieldCheck,
  Zap, MousePointerClick,
  Palette, GripHorizontal,
  BoxSelect, Stamp, Mail,
  Paperclip, Tag as TagIcon, Database,
  AlignRight, AlignCenter, Bold, Italic, Underline,
  SplitSquareHorizontal, Move, Component, Activity,
} from 'lucide-react';
import {
  Button,
  IconButton,
  Badge,
  Field,
  Input,
  Textarea,
  Switch,
  SegmentedControl,
  EmptyState,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';

export default function SabSignFormBuilder() {
  const { toast } = useToast();
  const [activeLeftTab, setActiveLeftTab] = useState('fields');
  const [activeRightTab, setActiveRightTab] = useState('properties');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedField, setSelectedField] = useState<string | null>('field-1');
  const [canvasMode, setCanvasMode] = useState('select');
  const [activeRecipient, setActiveRecipient] = useState('signer1');
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isRequired, setIsRequired] = useState(true);

  const tools = {
    signature: [
      { id: 'sig', name: 'Signature', icon: PenTool },
      { id: 'initials', name: 'Initials', icon: Stamp },
      { id: 'stamp', name: 'Company Stamp', icon: Zap },
    ],
    standard: [
      { id: 'name', name: 'Full Name', icon: Type },
      { id: 'email', name: 'Email Address', icon: Mail },
      { id: 'company', name: 'Company', icon: Briefcase },
      { id: 'title', name: 'Job Title', icon: TagIcon },
      { id: 'date', name: 'Date Signed', icon: Calendar },
    ],
    custom: [
      { id: 'text', name: 'Text Field', icon: AlignLeft },
      { id: 'checkbox', name: 'Checkbox', icon: CheckSquare },
      { id: 'radio', name: 'Radio Group', icon: MousePointerClick },
      { id: 'dropdown', name: 'Dropdown', icon: List },
      { id: 'attachment', name: 'Attachment', icon: Paperclip },
      { id: 'formula', name: 'Formula', icon: Activity },
    ],
  };

  // Recipient colors are data-driven runtime values, kept as inline color tokens.
  const recipients = [
    { id: 'signer1', name: 'Client (Signer 1)', color: '#3b82f6', role: 'Needs to Sign', email: 'client@example.com' },
    { id: 'signer2', name: 'Manager (Signer 2)', color: '#10b981', role: 'Needs to Sign', email: 'manager@company.com' },
    { id: 'cc1', name: 'Legal Dept', color: '#a855f7', role: 'Receives a Copy', email: 'legal@company.com' },
  ];

  const droppedFields = [
    { id: 'field-1', type: 'signature', label: 'Signature', x: 120, y: 780, w: 200, h: 50, recipient: 'signer1', required: true },
    { id: 'field-2', type: 'date', label: 'Date Signed', x: 450, y: 780, w: 150, h: 50, recipient: 'signer1', required: true },
    { id: 'field-3', type: 'name', label: 'Printed Name', x: 120, y: 850, w: 200, h: 30, recipient: 'signer1', required: false },
    { id: 'field-4', type: 'checkbox', label: 'I agree to terms', x: 120, y: 720, w: 20, h: 20, recipient: 'signer1', required: true },
    { id: 'field-5', type: 'initials', label: 'Initials', x: 680, y: 150, w: 60, h: 40, recipient: 'signer2', required: true },
  ];

  const propertiesItems = [
    { value: 'properties', label: 'Settings', icon: Settings },
    { value: 'logic', label: 'Logic', icon: SplitSquareHorizontal },
    { value: 'appearance', label: 'Style', icon: Palette },
  ];

  const renderFieldOnCanvas = (field: typeof droppedFields[number]) => {
    const isSelected = selectedField === field.id;
    const recipientColor = recipients.find((r) => r.id === field.recipient)?.color ?? 'var(--st-text-secondary)';

    return (
      <div
        key={field.id}
        onClick={() => setSelectedField(field.id)}
        className={`absolute cursor-move flex items-center justify-center transition-all rounded-[var(--st-radius-sm)] ${
          isSelected
            ? 'ring-2 z-20 shadow-[var(--st-shadow-md)]'
            : 'ring-1 ring-[var(--st-border)] hover:ring-[var(--st-accent)] z-10'
        }`}
        style={{
          left: `${field.x}px`,
          top: `${field.y}px`,
          width: `${field.w}px`,
          height: `${field.h}px`,
          backgroundColor: isSelected ? 'color-mix(in srgb, var(--st-accent) 10%, transparent)' : 'rgba(255, 255, 255, 0.9)',
          boxShadow: isSelected ? '0 0 0 2px var(--st-accent)' : undefined,
        }}
      >
        <div className="absolute top-0 left-0 w-full h-1 opacity-80 rounded-t-[var(--st-radius-sm)]" style={{ backgroundColor: recipientColor }} />

        {field.type === 'signature' && <PenTool className="w-5 h-5" style={{ color: recipientColor }} />}
        {field.type === 'date' && <Calendar className="w-5 h-5" style={{ color: recipientColor }} />}
        {field.type === 'name' && <Type className="w-5 h-5" style={{ color: recipientColor }} />}
        {field.type === 'checkbox' && <CheckSquare className="w-5 h-5" style={{ color: recipientColor }} />}
        {field.type === 'initials' && <Stamp className="w-5 h-5" style={{ color: recipientColor }} />}

        {isSelected && (
          <>
            <IconButton
              label="Remove field"
              icon={X}
              variant="danger"
              size="sm"
              className="absolute -top-3 -right-3 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                toast.success('Field removed');
              }}
            />
            {/* Resize Handles. Runtime-positioned visual affordances. */}
            <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full cursor-se-resize border-2 border-white" style={{ backgroundColor: 'var(--st-accent)' }} />
            <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full cursor-sw-resize border-2 border-white" style={{ backgroundColor: 'var(--st-accent)' }} />
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full cursor-ne-resize border-2 border-white" style={{ backgroundColor: 'var(--st-accent)' }} />
            <span className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full cursor-nw-resize border-2 border-white" style={{ backgroundColor: 'var(--st-accent)' }} />
          </>
        )}

        <span className="absolute -bottom-6 left-0 text-[10px] font-medium px-1 rounded truncate max-w-full bg-zinc-100/80" style={{ color: recipientColor }}>
          {field.label} {field.required && '*'}
        </span>
      </div>
    );
  };

  const activeRecipientColor = recipients.find((r) => r.id === activeRecipient)?.color;

  return (
    <div className="20ui dark flex flex-col h-screen bg-[var(--st-bg)] text-[var(--st-text)] overflow-hidden">

      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[var(--st-bg)] border-b border-[var(--st-border)] shrink-0 z-30">
        <div className="flex items-center gap-4">
          <IconButton label="Back" icon={ArrowLeft} variant="ghost" />
          <div className="h-6 w-px bg-[var(--st-border)]" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-wide text-[var(--st-text)]">Enterprise_NDA_v2.pdf</h1>
              <Badge tone="neutral">Draft</Badge>
            </div>
            <span className="text-xs text-[var(--st-text-secondary)]">Last saved just now</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Canvas Tools */}
          <div className="flex items-center gap-1 p-1 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)] mr-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  label="Select tool"
                  icon={MousePointer2}
                  size="sm"
                  variant={canvasMode === 'select' ? 'secondary' : 'ghost'}
                  onClick={() => setCanvasMode('select')}
                />
              </TooltipTrigger>
              <TooltipContent>Select Tool (V)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  label="Pan tool"
                  icon={Hand}
                  size="sm"
                  variant={canvasMode === 'pan' ? 'secondary' : 'ghost'}
                  onClick={() => setCanvasMode('pan')}
                />
              </TooltipTrigger>
              <TooltipContent>Pan Tool (H)</TooltipContent>
            </Tooltip>
            <div className="w-px h-4 bg-[var(--st-border)] mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton label="Undo" icon={Undo} size="sm" variant="ghost" />
              </TooltipTrigger>
              <TooltipContent>Undo (Cmd+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton label="Redo" icon={Redo} size="sm" variant="ghost" />
              </TooltipTrigger>
              <TooltipContent>Redo (Cmd+Shift+Z)</TooltipContent>
            </Tooltip>
          </div>

          <IconButton label="Document settings" icon={Settings} variant="ghost" className="mr-2" />

          <Button variant="secondary" iconLeft={Eye}>Preview</Button>
          <Button variant="primary" iconLeft={Send} onClick={() => toast.success('Document sent for signature')}>
            Send for Signature
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left Sidebar - Tool Palette */}
        <div className="w-72 bg-[var(--st-bg)] border-r border-[var(--st-border)] flex flex-col shrink-0 z-20">
          {/* Sidebar Tabs */}
          <div className="p-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            <SegmentedControl
              aria-label="Sidebar section"
              fullWidth
              size="sm"
              value={activeLeftTab}
              onChange={setActiveLeftTab}
              items={[
                { value: 'fields', label: 'Fields', icon: LayoutTemplate },
                { value: 'recipients', label: 'Recipients', icon: Users },
                { value: 'data', label: 'Data', icon: Database },
              ]}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeLeftTab === 'fields' && (
              <>
                {/* Active Recipient Selector */}
                <Field label="Assign Fields To">
                  <div className="relative">
                    <Select value={activeRecipient} onValueChange={setActiveRecipient}>
                      <SelectTrigger aria-label="Assign fields to recipient">
                        <SelectValue placeholder="Select a recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {recipients.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeRecipientColor ? (
                      <span
                        className="absolute right-9 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
                        style={{ backgroundColor: activeRecipientColor }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                </Field>

                {/* Signature Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-[var(--st-text-secondary)] flex items-center gap-2 uppercase tracking-wider">
                    <FileSignature className="w-3.5 h-3.5" /> E-Signature
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {tools.signature.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex flex-col items-center justify-center p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] cursor-grab hover:border-[var(--st-accent)] transition-all group"
                      >
                        <tool.icon className="w-5 h-5 mb-2 text-[var(--st-accent)] group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-medium text-[var(--st-text)]">{tool.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px w-full bg-[var(--st-border)]" />

                {/* Standard Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-[var(--st-text-secondary)] flex items-center gap-2 uppercase tracking-wider">
                    <Component className="w-3.5 h-3.5" /> Auto-Fill Fields
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {tools.standard.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex flex-col items-start p-2.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] cursor-grab hover:border-[var(--st-border-strong)] transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <tool.icon className="w-3.5 h-3.5 text-[var(--st-text-secondary)]" />
                          <span className="text-[11px] font-medium text-[var(--st-text)]">{tool.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px w-full bg-[var(--st-border)]" />

                {/* Custom Data Fields */}
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-[var(--st-text-secondary)] flex items-center gap-2 uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5" /> Input Fields
                  </h3>
                  <div className="flex flex-col gap-2">
                    {tools.custom.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center p-2.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] cursor-grab hover:border-[var(--st-border-strong)] transition-all group relative overflow-hidden"
                      >
                        <span className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--st-accent)] opacity-50" aria-hidden="true" />
                        <tool.icon className="w-4 h-4 ml-2 mr-3 text-[var(--st-text-secondary)]" />
                        <span className="text-xs font-medium text-[var(--st-text)]">{tool.name}</span>
                        <GripHorizontal className="w-3.5 h-3.5 text-[var(--st-text-muted)] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeLeftTab === 'recipients' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--st-text)]">Signing Order</h3>
                  <Button variant="ghost" size="sm" iconLeft={Plus} onClick={() => toast.success('Recipient added')}>Add</Button>
                </div>

                <div className="space-y-2">
                  {recipients.map((r, index) => (
                    <div key={r.id} className="p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] group hover:border-[var(--st-border-strong)] transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: r.color }}
                          >
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-[var(--st-text)]">{r.name}</span>
                        </div>
                        <IconButton label={`More options for ${r.name}`} icon={MoreVertical} variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="pl-7 space-y-1">
                        <div className="text-xs text-[var(--st-text-secondary)]">{r.email}</div>
                        <Badge tone="neutral">{r.role}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeLeftTab === 'data' && (
              <EmptyState
                icon={Database}
                title="No data sources connected"
                description="Map document fields to a connected data source to pre-fill values automatically."
                action={<Button variant="secondary" iconLeft={Plus}>Connect a source</Button>}
              />
            )}
          </div>
        </div>

        {/* Center Canvas Area (PDF Mockup) */}
        <div className="flex-1 bg-[var(--st-bg)] relative overflow-hidden flex flex-col">

          {/* Canvas Toolbar overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] shadow-[var(--st-shadow-md)]">
            <IconButton
              label="Zoom out"
              icon={ZoomOut}
              size="sm"
              variant="ghost"
              onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
            />
            <span className="w-16 text-center text-xs font-semibold text-[var(--st-text)]">{zoomLevel}%</span>
            <IconButton
              label="Zoom in"
              icon={ZoomIn}
              size="sm"
              variant="ghost"
              onClick={() => setZoomLevel(Math.min(300, zoomLevel + 25))}
            />
            <div className="w-px h-4 bg-[var(--st-border)] mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  label="Toggle grid"
                  icon={BoxSelect}
                  size="sm"
                  variant={isGridVisible ? 'secondary' : 'ghost'}
                  onClick={() => setIsGridVisible(!isGridVisible)}
                />
              </TooltipTrigger>
              <TooltipContent>Toggle Grid</TooltipContent>
            </Tooltip>
          </div>

          {/* Canvas Container */}
          <div className="flex-1 overflow-auto relative bg-[var(--st-bg-muted)] flex items-start justify-center p-12">

            {/* The PDF Document Page. Zoom scale is a runtime-computed transform. */}
            <div
              className="relative bg-white shadow-[var(--st-shadow-lg)] transition-transform origin-top"
              style={{
                width: '816px',
                height: '1056px',
                transform: `scale(${zoomLevel / 100})`,
                cursor: canvasMode === 'pan' ? 'grab' : 'default',
              }}
            >
              {/* Grid overlay. Runtime-toggled background pattern. */}
              {isGridVisible && (
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{
                    backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />
              )}

              {/* Mock Document Content */}
              <div className="p-16 text-zinc-800 h-full flex flex-col font-serif select-none pointer-events-none">
                <div className="flex justify-between items-end border-b-2 border-zinc-800 pb-4 mb-8">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight">NON-DISCLOSURE AGREEMENT</h1>
                    <p className="text-zinc-500 mt-2 text-sm font-sans">Document ID: SAB-2026-991A</p>
                  </div>
                  <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center border border-zinc-200">
                    <span className="text-[10px] text-zinc-400 font-sans">LOGO</span>
                  </div>
                </div>

                <div className="space-y-6 text-[15px] leading-relaxed text-justify">
                  <p>
                    This Non-Disclosure Agreement (the "Agreement") is entered into as of the date of the last signature below (the "Effective Date") by and between the Disclosing Party and the Receiving Party (collectively referred to as the "Parties").
                  </p>

                  <div className="bg-zinc-50 p-6 border border-zinc-200 rounded-sm">
                    <h3 className="font-bold mb-4 font-sans text-sm uppercase tracking-wide text-zinc-500">1. Definition of Confidential Information</h3>
                    <p>
                      For purposes of this Agreement, "Confidential Information" shall include all information or material that has or could have commercial value or other utility in the business in which Disclosing Party is engaged. If Confidential Information is in written form, the Disclosing Party shall label or stamp the materials with the word "Confidential" or some similar warning. If Confidential Information is transmitted orally, the Disclosing Party shall promptly provide a writing indicating that such oral communication constituted Confidential Information.
                    </p>
                  </div>

                  <p>
                    <strong>2. Exclusions from Confidential Information.</strong> Receiving Party's obligations under this Agreement do not extend to information that is: (a) publicly known at the time of disclosure or subsequently becomes publicly known through no fault of the Receiving Party; (b) discovered or created by the Receiving Party before disclosure by Disclosing Party; (c) learned by the Receiving Party through legitimate means other than from the Disclosing Party or Disclosing Party's representatives; or (d) is disclosed by Receiving Party with Disclosing Party's prior written approval.
                  </p>

                  <p>
                    <strong>3. Obligations of Receiving Party.</strong> Receiving Party shall hold and maintain the Confidential Information in strictest confidence for the sole and exclusive benefit of the Disclosing Party. Receiving Party shall carefully restrict access to Confidential Information to employees, contractors and third parties as is reasonably required and shall require those persons to sign nondisclosure restrictions at least as protective as those in this Agreement.
                  </p>

                  <p>
                    <strong>4. Time Periods.</strong> The nondisclosure provisions of this Agreement shall survive the termination of this Agreement and Receiving Party's duty to hold Confidential Information in confidence shall remain in effect until the Confidential Information no longer qualifies as a trade secret or until Disclosing Party sends Receiving Party written notice releasing Receiving Party from this Agreement, whichever occurs first.
                  </p>
                </div>

                <div className="mt-auto">
                  <h3 className="font-bold text-lg mb-8">IN WITNESS WHEREOF, the Parties have executed this Agreement.</h3>

                  <div className="flex justify-between gap-12">
                    <div className="flex-1 space-y-8">
                      <div className="font-bold font-sans text-sm text-zinc-500 uppercase tracking-wide">Disclosing Party (Party A)</div>
                      <div className="border-b border-zinc-400 relative h-10" />
                      <div className="border-b border-zinc-400 relative h-10" />
                    </div>
                    <div className="flex-1 space-y-8">
                      <div className="font-bold font-sans text-sm text-zinc-500 uppercase tracking-wide">Receiving Party (Party B)</div>
                      <div className="border-b border-zinc-400 relative h-10" />
                      <div className="border-b border-zinc-400 relative h-10" />
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-8 left-0 w-full text-center text-xs text-zinc-400 font-sans">
                  Page 1 of 1
                </div>
              </div>

              {/* Render Dropped Form Fields */}
              {droppedFields.map(renderFieldOnCanvas)}

            </div>
          </div>

          {/* Page Navigator Bottom Right */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-[var(--st-bg-secondary)] p-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] shadow-[var(--st-shadow-md)] z-20">
            <IconButton label="Previous page" icon={ChevronUp} size="sm" variant="ghost" />
            <span className="text-xs font-medium text-[var(--st-text)] px-2">Page 1 / 4</span>
            <IconButton label="Next page" icon={ChevronDown} size="sm" variant="ghost" />
          </div>

        </div>

        {/* Right Sidebar - Properties */}
        <div className="w-80 bg-[var(--st-bg)] border-l border-[var(--st-border)] flex flex-col shrink-0 z-20">
          {/* Header */}
          <div className="p-4 border-b border-[var(--st-border)] flex items-center gap-3 bg-[var(--st-bg-secondary)]">
            <span className="w-8 h-8 rounded-[var(--st-radius)] border border-[var(--st-border)] flex items-center justify-center text-[var(--st-accent)] bg-[var(--st-bg)]">
              <PenTool className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--st-text)]">Signature Field</h2>
              <p className="text-xs text-[var(--st-text-secondary)]">ID: field-1</p>
            </div>
          </div>

          {/* Properties Tabs */}
          <div className="p-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
            <SegmentedControl
              aria-label="Field property section"
              fullWidth
              size="sm"
              value={activeRightTab}
              onChange={setActiveRightTab}
              items={propertiesItems}
            />
          </div>

          {/* Properties Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {activeRightTab === 'properties' && (
              <>
                {/* Basic Settings */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider">Basic</h3>

                  <Field
                    label={
                      <span className="flex items-center justify-between w-full">
                        Field Label
                        <span className="text-[10px] text-[var(--st-text-muted)]">Visible to signer</span>
                      </span>
                    }
                  >
                    <Input defaultValue="Signature" />
                  </Field>

                  <Field label="Data Label (API Key)">
                    <Input defaultValue="signer_1_signature" iconLeft={Hash} className="font-mono" />
                  </Field>

                  <Field label="Assigned To">
                    <Select defaultValue="signer1">
                      <SelectTrigger aria-label="Assigned to">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="signer1">Client (Signer 1)</SelectItem>
                        <SelectItem value="signer2">Manager (Signer 2)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="h-px w-full bg-[var(--st-border)]" />

                {/* Validation */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider">Validation</h3>

                  <div className="flex items-center justify-between p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--st-text)]">Required Field</span>
                      <span className="text-[11px] text-[var(--st-text-secondary)]">Must be filled to submit</span>
                    </div>
                    <Switch aria-label="Required field" checked={isRequired} onCheckedChange={setIsRequired} />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] opacity-60">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--st-text)]">Read Only</span>
                      <span className="text-[11px] text-[var(--st-text-secondary)]">Signer cannot edit</span>
                    </div>
                    <Switch aria-label="Read only" disabled />
                  </div>
                </div>

                <div className="h-px w-full bg-[var(--st-border)]" />

                {/* Advanced */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider">Advanced</h3>

                  <Field label="Tooltip / Help Text">
                    <Textarea rows={2} placeholder="Add instructions for the signer..." className="resize-none" />
                  </Field>
                </div>
              </>
            )}

            {activeRightTab === 'logic' && (
              <div className="space-y-6">
                <EmptyState
                  icon={SplitSquareHorizontal}
                  tone="info"
                  title="Conditional Logic"
                  description="Show or hide this field based on other field values."
                  action={<Button variant="secondary" onClick={() => toast.success('Rule editor opened')}>Add Rule</Button>}
                />

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                    <ShieldCheck className="w-4 h-4 text-[var(--st-status-ok)]" /> No logic rules applied yet.
                  </div>
                  <div className="p-3 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] space-y-2 opacity-50 select-none">
                    <div className="text-[11px] text-[var(--st-text-secondary)] font-medium uppercase">Example Rule</div>
                    <div className="text-sm text-[var(--st-text)]">
                      <span className="text-[var(--st-accent)]">IF</span> Checkbox 1 <span className="text-[var(--st-accent)]">IS</span> Checked<br />
                      <span className="text-[var(--st-status-ok)]">THEN</span> Show this field
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeRightTab === 'appearance' && (
              <div className="space-y-6">
                {/* Dimensions */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                    <Move className="w-3.5 h-3.5" /> Dimensions & Position
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Width (px)">
                      <Input type="number" defaultValue="200" inputSize="sm" />
                    </Field>
                    <Field label="Height (px)">
                      <Input type="number" defaultValue="50" inputSize="sm" />
                    </Field>
                    <Field label="X Pos">
                      <Input type="number" defaultValue="120" inputSize="sm" />
                    </Field>
                    <Field label="Y Pos">
                      <Input type="number" defaultValue="780" inputSize="sm" />
                    </Field>
                  </div>
                </div>

                <div className="h-px w-full bg-[var(--st-border)]" />

                {/* Styling (Disabled for signature, but mock UI) */}
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <h3 className="text-[11px] font-bold text-[var(--st-text-secondary)] uppercase tracking-wider flex items-center gap-2">
                    <Type className="w-3.5 h-3.5" /> Typography
                  </h3>

                  <Field label="Font Family">
                    <Select defaultValue="inter">
                      <SelectTrigger aria-label="Font family">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inter">Inter (Sans-serif)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Field label="Size">
                        <Select defaultValue="14">
                          <SelectTrigger aria-label="Font size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="14">14px</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="flex-1">
                      <Field label="Color">
                        <div className="w-full h-[34px] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] flex items-center px-2 gap-2">
                          <span className="w-4 h-4 rounded bg-black border border-[var(--st-border)]" aria-hidden="true" />
                          <span className="text-xs text-[var(--st-text)]">#000000</span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)] p-1 w-fit">
                    <IconButton label="Bold" icon={Bold} size="sm" variant="ghost" />
                    <IconButton label="Italic" icon={Italic} size="sm" variant="ghost" />
                    <IconButton label="Underline" icon={Underline} size="sm" variant="ghost" />
                    <div className="w-px h-4 bg-[var(--st-border)] mx-1" />
                    <IconButton label="Align left" icon={AlignLeft} size="sm" variant="secondary" />
                    <IconButton label="Align center" icon={AlignCenter} size="sm" variant="ghost" />
                    <IconButton label="Align right" icon={AlignRight} size="sm" variant="ghost" />
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Quick Actions Bottom */}
          <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center gap-2">
            <Button variant="secondary" block iconLeft={Copy} onClick={() => toast.success('Field duplicated')}>Duplicate</Button>
            <Button variant="danger" block iconLeft={Trash2} onClick={() => toast.success('Field deleted')}>Delete</Button>
          </div>

        </div>

      </div>
    </div>
  );
}
