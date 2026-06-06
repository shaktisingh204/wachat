"use client";

import React, { useState } from "react";
import {
  FileText,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Printer,
  MoreVertical,
  Check,
  AlertCircle,
  PenTool,
  Clock,
  User,
  Shield,
  MessageSquare,
  History,
  Info,
  Type,
  Image as ImageIcon,
  Calendar,
  LayoutTemplate,
  Eye,
  FileSignature,
} from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Badge,
  Field,
  Input,
  Textarea,
  Checkbox,
  Progress,
  Modal,
  SegmentedControl,
  Avatar,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  PageEyebrow,
  useToast,
} from "@/components/sabcrm/20ui";

// Mock Data
const DOCUMENT_PAGES = [
  { id: 1, height: "800px", fields: [
    { id: "f1", type: "text", x: 15, y: 25, label: "Full Name", required: true, value: "" },
    { id: "f2", type: "date", x: 60, y: 25, label: "Date", required: true, value: "" },
    { id: "f3", type: "checkbox", x: 15, y: 35, label: "I agree to the terms", required: true, value: false },
  ]},
  { id: 2, height: "800px", fields: [
    { id: "f4", type: "signature", x: 20, y: 70, label: "Client Signature", required: true, value: null },
    { id: "f5", type: "signature", x: 60, y: 70, label: "Agent Signature", required: false, value: null },
  ]},
  { id: 3, height: "800px", fields: [
    { id: "f6", type: "text", x: 15, y: 15, label: "Company Name", required: false, value: "" },
    { id: "f7", type: "text", x: 15, y: 25, label: "Address", required: false, value: "" },
    { id: "f8", type: "initials", x: 80, y: 85, label: "Initials", required: true, value: null },
  ]}
];

const AUDIT_TRAIL = [
  { id: 1, action: "Document Created", user: "Alice Admin", time: "Oct 24, 2023, 09:00 AM", icon: <FileText className="w-4 h-4" aria-hidden="true" /> },
  { id: 2, action: "Sent to Signers", user: "System", time: "Oct 24, 2023, 09:05 AM", icon: <Check className="w-4 h-4" aria-hidden="true" /> },
  { id: 3, action: "Viewed by John Doe", user: "John Doe", time: "Oct 24, 2023, 10:15 AM", icon: <Eye className="w-4 h-4" aria-hidden="true" /> },
];

const SIGNATURE_FONTS = [
  { id: "font-serif", name: "Classic Serif" },
  { id: "font-sans", name: "Modern Sans" },
  { id: "font-mono", name: "Typewriter" },
  { id: "italic font-serif", name: "Elegant Italic" },
];

export default function SignerPortalPage() {
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [activeSidebar, setActiveSidebar] = useState<"comments" | "audit" | "details">("details");
  const [documentFields, setDocumentFields] = useState(DOCUMENT_PAGES);

  // Modals state
  const [showAdoptSignature, setShowAdoptSignature] = useState(false);
  const [showFinalize, setShowFinalize] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // Adopt Signature State
  const [signatureMode, setSignatureMode] = useState<"draw" | "type" | "upload">("draw");
  const [typedSignature, setTypedSignature] = useState("");
  const [typedInitials, setTypedInitials] = useState("");
  const [selectedFont, setSelectedFont] = useState("font-serif");

  // Navigation
  const requiredFields = documentFields.flatMap(p => p.fields).filter(f => f.required && !f.value);
  const totalRequired = documentFields.flatMap(p => p.fields).filter(f => f.required).length;
  const completedRequired = totalRequired - requiredFields.length;
  const progress = (completedRequired / totalRequired) * 100;

  const handleNextRequired = () => {
    if (requiredFields.length > 0) {
      const nextField = requiredFields[0];
      const pageIndex = documentFields.findIndex(p => p.fields.some(f => f.id === nextField.id));
      if (pageIndex !== -1) {
        setCurrentPage(pageIndex + 1);
        // In a real app, we would scroll to the field
      }
    } else {
      setShowFinalize(true);
    }
  };

  const handleFieldClick = (fieldId: string, fieldType: string) => {
    if (fieldType === "signature" || fieldType === "initials") {
      setActiveFieldId(fieldId);
      setShowAdoptSignature(true);
    }
  };

  const updateFieldValue = (fieldId: string, value: any) => {
    setDocumentFields(prev => prev.map(page => ({
      ...page,
      fields: page.fields.map(f => f.id === fieldId ? { ...f, value } : f)
    })));
  };

  const applySignature = () => {
    if (activeFieldId) {
      updateFieldValue(activeFieldId, signatureMode === "type" ? typedSignature : "[Drawn Signature]");
    }
    setShowAdoptSignature(false);
    setActiveFieldId(null);
  };

  const handleFinalSign = () => {
    setShowFinalize(false);
    toast.success("Document signed successfully");
  };

  return (
    <div className="ui20 dark flex flex-col h-screen overflow-hidden bg-[var(--st-bg)] text-[var(--st-text)]">

      {/* Top Navigation Bar */}
      <header className="flex-none h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <span className="w-10 h-10 rounded-[var(--st-radius-lg)] bg-[var(--st-accent)] flex items-center justify-center shadow-[var(--st-shadow-md)]" aria-hidden="true">
            <FileSignature className="w-5 h-5 text-[var(--st-text-inverted)]" />
          </span>
          <div>
            <PageEyebrow className="!m-0">Signer portal</PageEyebrow>
            <h1 className="text-lg font-semibold tracking-tight leading-tight text-[var(--st-text)]">Master Services Agreement 2024.pdf</h1>
            <div className="flex items-center text-xs text-[var(--st-text-secondary)] gap-2">
              <span className="flex items-center"><User className="w-3 h-3 mr-1" aria-hidden="true" /> From: SabDesk Legal</span>
              <span aria-hidden="true">|</span>
              <Badge tone="warning" dot>Action Required</Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] p-1 border border-[var(--st-border)]">
            <IconButton label="Zoom out" icon={ZoomOut} size="sm" onClick={() => setZoom(z => Math.max(50, z - 10))} />
            <span className="text-xs font-medium w-12 text-center text-[var(--st-text)]">{zoom}%</span>
            <IconButton label="Zoom in" icon={ZoomIn} size="sm" onClick={() => setZoom(z => Math.min(200, z + 10))} />
          </div>

          <div className="flex gap-1">
            <IconButton label="Download document" icon={Download} />
            <IconButton label="Print document" icon={Printer} />
            <IconButton label="More actions" icon={MoreVertical} />
          </div>

          <div className="h-8 w-px bg-[var(--st-border)]" aria-hidden="true" />

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="text-xs text-[var(--st-text-secondary)] mb-1">{completedRequired} of {totalRequired} required fields</div>
              <Progress value={progress} size="sm" className="w-32" aria-label="Required fields completed" />
            </div>

            {requiredFields.length > 0 ? (
              <Button variant="primary" iconRight={ChevronRight} onClick={handleNextRequired}>
                Next Required
              </Button>
            ) : (
              <Button variant="primary" iconLeft={Check} onClick={() => setShowFinalize(true)}>
                Finish Signing
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Sidebar (Thumbnails) */}
        <aside className="w-64 flex-none border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex-col hidden md:flex z-10">
          <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--st-text)]">Pages</h2>
            <LayoutTemplate className="w-4 h-4 text-[var(--st-text-tertiary)]" aria-hidden="true" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {DOCUMENT_PAGES.map((page, index) => (
              <Button
                key={page.id}
                variant="ghost"
                onClick={() => setCurrentPage(index + 1)}
                aria-label={`Go to page ${index + 1}`}
                aria-current={currentPage === index + 1 ? "true" : undefined}
                className={`!h-auto !p-0 !block w-full text-left relative group rounded-[var(--st-radius-lg)] [&_.u-btn__label]:!block [&_.u-btn__label]:!w-full [&_.u-btn__label]:!overflow-visible ${currentPage === index + 1 ? "ring-2 ring-[var(--st-accent)]" : ""}`}
              >
                <div className="aspect-[1/1.4] bg-white rounded-[var(--st-radius-lg)] shadow-[var(--st-shadow-sm)] overflow-hidden flex items-center justify-center p-2 transition-transform group-hover:scale-[1.02]">
                  <div className="w-full h-full border border-neutral-200 bg-neutral-50 flex flex-col relative">
                    {/* Mini skeleton for document content */}
                    <div className="p-2 space-y-1 opacity-20">
                      <div className="h-1 bg-black w-3/4 rounded" />
                      <div className="h-1 bg-black w-full rounded" />
                      <div className="h-1 bg-black w-5/6 rounded" />
                      <div className="h-1 bg-black w-full rounded" />
                    </div>
                    {/* Indicator for fields on this page */}
                    {page.fields.some(f => f.required && !f.value) && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-[var(--st-radius-pill)] bg-[var(--st-warn)]" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <div className="text-center mt-2 text-xs text-[var(--st-text-tertiary)] font-medium">Page {index + 1}</div>
              </Button>
            ))}
          </div>
        </aside>

        {/* Center Document Viewer */}
        <main className="flex-1 overflow-auto bg-[var(--st-bg)] flex flex-col relative p-8">
          <div
            className="mx-auto flex flex-col space-y-8 transition-transform origin-top"
            style={{
              transform: `scale(${zoom / 100})`,
            }}
          >
            {documentFields.map((page, index) => (
              <div
                key={page.id}
                className="w-[800px] h-[1130px] bg-white shadow-[var(--st-shadow-lg)] rounded-[var(--st-radius-sm)] relative shrink-0"
              >
                {/* Mock Document Content Pattern */}
                <div className="absolute inset-0 p-16 pointer-events-none opacity-5">
                  <div className="h-8 bg-black w-1/2 mb-10" />
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className={`h-3 bg-black mb-4 ${i % 4 === 0 ? "w-5/6" : "w-full"}`} />
                  ))}
                </div>

                {/* Page Number */}
                <div className="absolute bottom-6 right-8 text-neutral-400 text-sm font-medium">
                  Page {index + 1} of {DOCUMENT_PAGES.length}
                </div>

                {/* Document Fields Overlay */}
                {page.fields.map(field => {
                  const isCompleted = field.value !== null && field.value !== "" && field.value !== false;

                  return (
                    <div
                      key={field.id}
                      className={`absolute flex flex-col group ${
                        field.required && !isCompleted ? "z-20" : "z-10"
                      }`}
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                      }}
                    >
                      {field.required && !isCompleted && (
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 -translate-x-full bg-[var(--st-warn)] text-[var(--st-text-inverted)] text-xs px-2 py-1 rounded-[var(--st-radius-sm)] shadow-[var(--st-shadow-sm)] flex items-center whitespace-nowrap">
                          <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                          Required
                        </div>
                      )}

                      {field.type === "signature" || field.type === "initials" ? (
                        <Button
                          variant="ghost"
                          onClick={() => handleFieldClick(field.id, field.type)}
                          aria-label={isCompleted ? `${field.label} signed` : `Add ${field.label}`}
                          className={`
                            !h-auto !p-2 !block border-2 rounded-[var(--st-radius)] relative min-w-[200px] min-h-[60px] [&_.u-btn__label]:!block [&_.u-btn__label]:!w-full [&_.u-btn__label]:!overflow-visible
                            ${isCompleted
                              ? "!border-transparent !bg-transparent !text-black"
                              : field.required
                                ? "!border-amber-400 !bg-amber-50/50 !text-amber-700 hover:!bg-amber-100"
                                : "!border-neutral-300 !bg-neutral-50/50 !text-neutral-600 hover:!bg-neutral-100"}
                          `}
                        >
                          {isCompleted ? (
                            <div className="flex flex-col items-center w-full">
                              <span className={`text-3xl text-indigo-900 ${selectedFont}`}>{field.value}</span>
                              <div className="text-[8px] text-neutral-400 mt-1 uppercase tracking-wider">SabSigned by: {field.label}</div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              {field.type === "signature" ? <PenTool className="w-5 h-5 opacity-70" aria-hidden="true" /> : <Type className="w-5 h-5 opacity-70" aria-hidden="true" />}
                              <span className="font-semibold text-sm uppercase tracking-wider">{field.label}</span>
                            </div>
                          )}
                          {!isCompleted && field.required && (
                            <span className="absolute -top-2 -right-2 bg-[var(--st-warn)] text-[var(--st-text-inverted)] w-4 h-4 rounded-[var(--st-radius-pill)] flex items-center justify-center text-[10px] font-bold shadow-[var(--st-shadow-sm)]" aria-hidden="true">!</span>
                          )}
                        </Button>
                      ) : field.type === "text" || field.type === "date" ? (
                        <div className="relative w-48">
                          <Field label={<span className="text-neutral-500">{field.label}</span>} required={field.required}>
                            <Input
                              type={field.type === "date" ? "date" : "text"}
                              iconLeft={field.type === "date" ? Calendar : undefined}
                              placeholder={!isCompleted ? `Enter ${field.label.toLowerCase()}` : ""}
                              value={field.value as string}
                              onChange={(e) => updateFieldValue(field.id, e.target.value)}
                            />
                          </Field>
                        </div>
                      ) : field.type === "checkbox" ? (
                        <Checkbox
                          checked={Boolean(field.value)}
                          onChange={(e) => updateFieldValue(field.id, e.target.checked)}
                          label={<span className="text-neutral-700 font-medium">{field.label}</span>}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </main>

        {/* Right Sidebar (Tools/Info) */}
        <aside className="w-80 flex-none border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex flex-col z-10">
          <Tabs value={activeSidebar} onValueChange={(v) => setActiveSidebar(v as typeof activeSidebar)} className="flex flex-col h-full">
            <TabsList className="border-b border-[var(--st-border)]">
              <TabsTrigger value="details"><span className="flex items-center gap-1"><Info className="w-4 h-4" aria-hidden="true" /> Details</span></TabsTrigger>
              <TabsTrigger value="comments"><span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" aria-hidden="true" /> Comments</span></TabsTrigger>
              <TabsTrigger value="audit"><span className="flex items-center gap-1"><History className="w-4 h-4" aria-hidden="true" /> Audit</span></TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-5">
              <TabsContent value="details">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--st-text)] mb-3">Document Info</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--st-text-secondary)]">Status</span>
                        <Badge tone="warning">Action Required</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--st-text-secondary)]">Sent Date</span>
                        <span className="text-[var(--st-text)]">Oct 24, 2023</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--st-text-secondary)]">Expiration</span>
                        <span className="text-[var(--st-text)]">Nov 24, 2023</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--st-text-secondary)]">Sender</span>
                        <span className="text-[var(--st-text)]">Legal Dept.</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-[var(--st-border)]" aria-hidden="true" />

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--st-text)] mb-3">Recipients</h3>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Avatar name="John Doe" initials="JD" size="md" shape="round" />
                        <div>
                          <div className="text-sm font-medium text-[var(--st-text)] flex items-center gap-2">John Doe <Badge tone="warning" kind="soft">Current</Badge></div>
                          <div className="text-xs text-[var(--st-text-secondary)]">Signer | john@example.com</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Avatar name="Alice Smith" initials="AS" size="md" shape="round" />
                        <div>
                          <div className="text-sm font-medium text-[var(--st-text)]">Alice Smith</div>
                          <div className="text-xs text-[var(--st-text-secondary)]">Approver | Waiting</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-[var(--st-border)]" aria-hidden="true" />

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--st-text)] mb-3">Security</h3>
                    <Card variant="outlined" padding="sm">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-[var(--st-status-ok)] mt-0.5 flex-none" aria-hidden="true" />
                        <div>
                          <div className="text-sm font-medium text-[var(--st-text)]">Bank-level Encryption</div>
                          <div className="text-xs text-[var(--st-text-secondary)] mt-1">This document is secured with 256-bit encryption and complies with eSIGN and UETA standards.</div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audit">
                <div className="space-y-6">
                  <h3 className="text-sm font-semibold text-[var(--st-text)] mb-4">Activity Log</h3>
                  <div className="relative border-l border-[var(--st-border)] ml-3 space-y-6 pb-4">
                    {AUDIT_TRAIL.map((event) => (
                      <div key={event.id} className="relative pl-6">
                        <span className="absolute -left-3 top-0 w-6 h-6 rounded-[var(--st-radius-pill)] bg-[var(--st-bg)] border border-[var(--st-border-strong)] flex items-center justify-center text-[var(--st-text-secondary)]" aria-hidden="true">
                          {event.icon}
                        </span>
                        <div className="text-sm font-medium text-[var(--st-text)]">{event.action}</div>
                        <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">{event.time}</div>
                        <div className="text-xs text-[var(--st-text-secondary)] mt-1 flex items-center"><User className="w-3 h-3 mr-1" aria-hidden="true" /> {event.user}</div>
                      </div>
                    ))}
                    <div className="relative pl-6">
                      <span className="absolute -left-2 top-1 w-4 h-4 rounded-[var(--st-radius-pill)] bg-[var(--st-bg)] border border-[var(--st-accent)] flex items-center justify-center" aria-hidden="true">
                        <span className="w-1.5 h-1.5 rounded-[var(--st-radius-pill)] bg-[var(--st-accent)]" />
                      </span>
                      <div className="text-sm font-medium text-[var(--st-accent)]">Waiting for your signature</div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments">
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <Card variant="outlined" padding="sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-[var(--st-accent)] text-sm">Legal Dept.</span>
                        <span className="text-xs text-[var(--st-text-secondary)]">Oct 24</span>
                      </div>
                      <p className="text-sm text-[var(--st-text)]">Please review section 4 carefully before signing. We have updated the liability clauses.</p>
                    </Card>
                  </div>
                  <div className="mt-4 flex flex-col gap-2">
                    <Field label="Add a comment" className="!mb-0">
                      <Textarea placeholder="Add a comment..." rows={3} />
                    </Field>
                    <div className="flex justify-end">
                      <Button variant="primary" size="sm" iconLeft={Check}>Post</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </aside>
      </div>

      {/* Adopt Signature Modal */}
      <Modal
        open={showAdoptSignature}
        onClose={() => setShowAdoptSignature(false)}
        title="Adopt Your Signature"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAdoptSignature(false)}>Cancel</Button>
            <Button variant="primary" onClick={applySignature}>Adopt and Sign</Button>
          </div>
        }
      >
        <div className="space-y-6">
          <SegmentedControl
            aria-label="Signature method"
            fullWidth
            value={signatureMode}
            onChange={(v) => setSignatureMode(v as typeof signatureMode)}
            items={[
              { value: "draw", label: "Draw", icon: PenTool },
              { value: "type", label: "Type", icon: Type },
              { value: "upload", label: "Upload", icon: ImageIcon },
            ]}
          />

          {signatureMode === "draw" && (
            <div className="space-y-4">
              <div className="text-sm text-[var(--st-text-secondary)]">Draw your signature in the box below using your mouse or touch screen.</div>
              <div className="h-64 border-2 border-dashed border-[var(--st-border-strong)] bg-[var(--st-bg-muted)] rounded-[var(--st-radius-lg)] relative flex items-center justify-center cursor-crosshair">
                <span className="text-[var(--st-text-tertiary)] font-medium flex flex-col items-center">
                  <PenTool className="w-8 h-8 mb-2 opacity-50" aria-hidden="true" />
                  Sign Here
                </span>
                <div className="absolute bottom-4 left-4 right-4 h-px bg-[var(--st-border)]" aria-hidden="true" />
                <div className="absolute bottom-4 right-4">
                  <Button variant="secondary" size="sm">Clear</Button>
                </div>
              </div>
            </div>
          )}

          {signatureMode === "type" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name">
                  <Input value={typedSignature} onChange={e => setTypedSignature(e.target.value)} placeholder="John Doe" />
                </Field>
                <Field label="Initials">
                  <Input value={typedInitials} onChange={e => setTypedInitials(e.target.value)} placeholder="JD" />
                </Field>
              </div>

              <div className="space-y-3">
                <span className="text-sm font-medium text-[var(--st-text)]">Select Style</span>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                  {SIGNATURE_FONTS.map(font => (
                    <Button
                      key={font.id}
                      variant="ghost"
                      onClick={() => setSelectedFont(font.id)}
                      aria-pressed={selectedFont === font.id}
                      aria-label={font.name}
                      className={`!h-auto !p-4 !block rounded-[var(--st-radius-lg)] border text-left [&_.u-btn__label]:!block [&_.u-btn__label]:!w-full [&_.u-btn__label]:!overflow-visible ${
                        selectedFont === font.id
                          ? "!border-[var(--st-accent)] !bg-[var(--st-accent-soft)] ring-1 ring-[var(--st-accent)]"
                          : "!border-[var(--st-border)] !bg-[var(--st-bg)] hover:!border-[var(--st-border-strong)]"
                      }`}
                    >
                      <div className={`text-2xl text-[var(--st-text)] mb-2 ${font.id}`}>{typedSignature || "John Doe"}</div>
                      <div className={`text-sm text-[var(--st-text-secondary)] ${font.id}`}>{typedInitials || "JD"}</div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {signatureMode === "upload" && (
            <div className="space-y-4">
              <div className="text-sm text-[var(--st-text-secondary)]">Upload an image of your signature or initials.</div>
              <div className="h-64 border-2 border-dashed border-[var(--st-border-strong)] bg-[var(--st-bg-muted)] rounded-[var(--st-radius-lg)] flex flex-col items-center justify-center hover:bg-[var(--st-bg-secondary)] transition-colors cursor-pointer group">
                <span className="w-16 h-16 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-pill)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" aria-hidden="true">
                  <ImageIcon className="w-8 h-8 text-[var(--st-text-secondary)]" />
                </span>
                <span className="text-base font-medium text-[var(--st-text)] mb-1">Click to upload</span>
                <span className="text-xs text-[var(--st-text-secondary)]">PNG, JPG or GIF (max 5MB)</span>
              </div>
            </div>
          )}

          <Card variant="ghost" padding="sm" className="bg-[var(--st-bg-muted)]">
            <div className="flex items-start gap-3 text-sm">
              <Shield className="w-5 h-5 text-[var(--st-accent)] flex-none mt-0.5" aria-hidden="true" />
              <p className="text-[var(--st-text)]">By clicking <strong>Adopt and Sign</strong>, I agree that the signature and initials will be the electronic representation of my signature and initials for all purposes when I (or my agent) use them on documents, including legally binding contracts, just the same as a pen-and-paper signature or initial.</p>
            </div>
          </Card>
        </div>
      </Modal>

      {/* Finalize Signing Modal */}
      <Modal
        open={showFinalize}
        onClose={() => setShowFinalize(false)}
        title="Almost Done!"
        description="You have completed all required fields. Confirm below to finalize your signing process."
        size="md"
        footer={
          <div className="flex flex-col gap-3 w-full">
            <Button variant="primary" block iconLeft={FileSignature} onClick={handleFinalSign}>Agree and Sign</Button>
            <Button variant="ghost" block onClick={() => setShowFinalize(false)}>Return to Document</Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <span className="w-20 h-20 bg-[var(--st-bg-muted)] rounded-[var(--st-radius-pill)] flex items-center justify-center" aria-hidden="true">
              <Check className="w-10 h-10 text-[var(--st-status-ok)]" />
            </span>
          </div>

          <Card variant="outlined" padding="md">
            <CardHeader>
              <CardTitle className="flex items-center text-sm"><FileText className="w-4 h-4 mr-2 text-[var(--st-accent)]" aria-hidden="true" /> Document Summary</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Document</span>
                  <span className="text-[var(--st-text)] font-medium">Master Services Agreement 2024.pdf</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Total Pages</span>
                  <span className="text-[var(--st-text)] font-medium">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Fields Completed</span>
                  <span className="text-[var(--st-status-ok)] font-medium">{completedRequired} / {totalRequired}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="text-xs text-[var(--st-text-secondary)]">
            By clicking "Agree and Sign", you are legally binding yourself to the terms and conditions outlined in this document under the U.S. Electronic Signatures in Global and National Commerce Act (E-Sign Act).
          </div>
        </div>
      </Modal>

      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <IconButton
          label={requiredFields.length > 0 ? "Go to next required field" : "Finish signing"}
          icon={requiredFields.length > 0 ? ChevronRight : Check}
          variant="primary"
          size="lg"
          className="rounded-[var(--st-radius-pill)] w-14 h-14 shadow-[var(--st-shadow-lg)]"
          onClick={handleNextRequired}
        />
      </div>

    </div>
  );
}
