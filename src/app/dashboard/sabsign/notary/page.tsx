'use client';

import React, { useState } from 'react';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Settings,
  Maximize,
  FileText,
  PenTool,
  CheckCircle,
  AlertCircle,
  X,
  ChevronDown,
  Search,
  Filter,
  Download,
  MoreVertical,
  Shield,
  ShieldCheck,
  FileSignature,
  Camera,
  UploadCloud,
  Send,
  Clock,
  Stamp,
  Lock,
  Eye,
  Trash2,
  Calendar,
  CreditCard,
  UserCheck,
  FileKey,
  Globe,
  Fingerprint,
  MonitorUp,
  FileArchive,
  RefreshCw,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Badge,
  Dot,
  Card,
  CardBody,
  Avatar,
  Input,
  Switch,
  SegmentedControl,
  Alert,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';

// --- MOCK DATA ---

const MOCK_JOURNAL_ENTRIES = [
  { id: 'NJ-2024-001', date: '2024-05-12T10:30:00Z', type: 'Warranty Deed', signer: 'Eleanor Shellstrop', status: 'Completed', fee: '$25.00', idMethod: 'KBA + Biometric', ip: '192.168.1.45', location: 'Arizona, US' },
  { id: 'NJ-2024-002', date: '2024-05-14T14:15:00Z', type: 'Power of Attorney', signer: 'Chidi Anagonye', status: 'Completed', fee: '$25.00', idMethod: 'Credential Analysis', ip: '10.0.0.23', location: 'Texas, US' },
  { id: 'NJ-2024-003', date: '2024-05-15T09:00:00Z', type: 'Affidavit', signer: 'Tahani Al-Jamil', status: 'Failed ID Verification', fee: '$0.00', idMethod: 'Failed', ip: '172.16.0.99', location: 'New York, US' },
  { id: 'NJ-2024-004', date: '2024-05-16T11:45:00Z', type: 'Will and Testament', signer: 'Jason Mendoza', status: 'Completed', fee: '$25.00', idMethod: 'KBA + Biometric', ip: '192.168.1.102', location: 'Florida, US' },
  { id: 'NJ-2024-005', date: '2024-05-18T16:20:00Z', type: 'Quitclaim Deed', signer: 'Michael Realman', status: 'Completed', fee: '$25.00', idMethod: 'Credential Analysis', ip: '10.0.0.5', location: 'California, US' },
  { id: 'NJ-2024-006', date: '2024-05-20T13:10:00Z', type: 'Loan Modification', signer: 'Janet Della-Denunzio', status: 'Completed', fee: '$25.00', idMethod: 'KBA + Biometric', ip: '192.168.1.200', location: 'Nevada, US' },
  { id: 'NJ-2024-007', date: '2024-05-22T08:30:00Z', type: 'Trust Agreement', signer: 'Derek Hofstetler', status: 'Pending', fee: '$25.00', idMethod: 'Pending', ip: '172.16.0.55', location: 'Oregon, US' },
];

const MOCK_MESSAGES = [
  { sender: 'Notary (You)', text: 'Hello, I will be your notary today. Please ensure your camera is on and your ID is ready.', time: '10:00 AM' },
  { sender: 'Eleanor (Signer)', text: "Hi! Yes, I have my driver's license ready.", time: '10:01 AM' },
  { sender: 'Notary (You)', text: "Great. Let's proceed with the ID verification first.", time: '10:02 AM' },
];

type JournalStatusTone = 'success' | 'warning' | 'danger';

function journalStatusTone(status: string): JournalStatusTone {
  if (status === 'Completed') return 'success';
  if (status === 'Pending') return 'warning';
  return 'danger';
}

// --- COMPONENTS ---

const LiveSession = () => {
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [documentPage, setDocumentPage] = useState(1);
  const [chatMessage, setChatMessage] = useState('');

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Video & Controls Side */}
      <div className={`flex flex-col ${chatOpen ? 'w-full lg:w-1/3' : 'w-full lg:w-1/2'} transition-all duration-300 gap-4`}>
        {/* Main Video Area */}
        <div className="relative flex-1 bg-[var(--st-text)] rounded-[var(--st-radius-lg)] overflow-hidden border border-[var(--st-border-strong)] shadow-[var(--st-shadow-lg)] flex items-center justify-center">
          {/* Main Video (Signer) */}
          <div className="absolute inset-0 flex items-center justify-center">
            {videoOn ? (
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800" alt="Signer video feed" className="w-full h-full object-cover opacity-80" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-[var(--st-bg-muted)] rounded-full flex items-center justify-center mb-4">
                  <UserCheck size={40} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                </div>
                <p className="text-[var(--st-text-inverted)]">Signer camera off</p>
              </div>
            )}
            {/* Status Overlay */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-[var(--st-radius-pill)] flex items-center gap-2 border border-white/10">
              <Dot tone="danger" pulse aria-label="Recording" />
              <span className="text-xs font-medium text-white">REC</span>
              <span className="text-xs text-white/80 ml-2 border-l border-white/20 pl-2">04:23</span>
            </div>
            {/* Signer Name Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-[var(--st-radius)] border border-white/10">
              <span className="text-sm font-medium text-white">Eleanor Shellstrop (Signer)</span>
            </div>
          </div>

          {/* Picture in Picture (Notary) */}
          <div className="absolute bottom-4 right-4 w-32 h-48 bg-[var(--st-bg-muted)] rounded-[var(--st-radius-lg)] overflow-hidden border-2 border-[var(--st-border-strong)] shadow-[var(--st-shadow-md)]">
            <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300" alt="Notary video feed" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-[var(--st-radius-sm)] text-[10px] text-white">
              You
            </div>
          </div>
        </div>

        {/* Video Controls */}
        <Card variant="elevated" padding="sm" className="flex items-center justify-center gap-4">
          <IconButton
            label={micOn ? 'Mute microphone' : 'Unmute microphone'}
            icon={micOn ? Mic : MicOff}
            variant={micOn ? 'secondary' : 'danger'}
            onClick={() => setMicOn(!micOn)}
          />
          <IconButton
            label={videoOn ? 'Turn camera off' : 'Turn camera on'}
            icon={videoOn ? Video : VideoOff}
            variant={videoOn ? 'secondary' : 'danger'}
            onClick={() => setVideoOn(!videoOn)}
          />
          <IconButton label="Share screen" icon={MonitorUp} variant="secondary" />
          <IconButton
            label={chatOpen ? 'Hide session chat' : 'Show session chat'}
            icon={MessageSquare}
            variant={chatOpen ? 'primary' : 'secondary'}
            onClick={() => setChatOpen(!chatOpen)}
          />
          <IconButton label="End session" icon={PhoneOff} variant="danger" className="ml-4" />
        </Card>
      </div>

      {/* Document & Tools Side */}
      <Card variant="elevated" padding="none" className="flex flex-col flex-1 overflow-hidden transition-all duration-300">
        {/* Document Header */}
        <div className="h-16 border-b border-[var(--st-border)] flex items-center justify-between px-6 bg-[var(--st-bg-secondary)]">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-[var(--st-accent-soft)] text-[var(--st-accent)] rounded-[var(--st-radius)]">
              <FileText size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--st-text)]">Warranty_Deed_Final.pdf</h3>
              <p className="text-xs text-[var(--st-text-secondary)]">Page {documentPage} of 5</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              label="Previous page"
              icon={ChevronDown}
              variant="ghost"
              onClick={() => setDocumentPage(Math.max(1, documentPage - 1))}
              disabled={documentPage === 1}
              className="rotate-90"
            />
            <span className="text-sm font-medium text-[var(--st-text-secondary)]">{documentPage} / 5</span>
            <IconButton
              label="Next page"
              icon={ChevronDown}
              variant="ghost"
              onClick={() => setDocumentPage(Math.min(5, documentPage + 1))}
              disabled={documentPage === 5}
              className="-rotate-90"
            />
            <div className="w-px h-6 bg-[var(--st-border)] mx-2" />
            <Button variant="ghost" size="sm" iconLeft={Maximize}>
              <span className="hidden sm:inline">Fullscreen</span>
            </Button>
          </div>
        </div>

        {/* Document Viewer Area */}
        <div className="flex-1 relative bg-[var(--st-bg-muted)] overflow-auto p-4 md:p-8 flex justify-center">
          {/* Mock Document Page */}
          <div className="w-full max-w-3xl bg-white aspect-[8.5/11] shadow-[var(--st-shadow-lg)] rounded-[var(--st-radius)] border border-[var(--st-border)] relative p-12 flex flex-col">
            <h1 className="text-3xl font-serif text-center mb-8 text-black border-b pb-4">WARRANTY DEED</h1>
            <div className="space-y-4 text-sm font-serif text-neutral-800 leading-relaxed flex-1">
              <p>THIS INDENTURE, made on the 12th day of May, 2024, between <strong>Eleanor Shellstrop</strong>, hereinafter referred to as the "Grantor", and <strong>Chidi Anagonye</strong>, hereinafter referred to as the "Grantee".</p>
              <p>WITNESSETH: That Grantor, for and in consideration of the sum of TEN DOLLARS ($10.00) and other good and valuable consideration, receipt of which is hereby acknowledged, does hereby grant, bargain, sell, alien, remise, release, convey and confirm unto the Grantee all that certain land situated in Maricopa County, State of Arizona, viz:</p>
              <p className="pl-8 italic">Lot 42, Block 7, THE GOOD PLACE SUBDIVISION, according to the plat of record in the Office of the County Recorder of Maricopa County, Arizona, recorded in Book 123 of Maps, Page 45.</p>
              <p>TOGETHER with all the tenements, hereditaments and appurtenances thereto belonging or in anywise appertaining.</p>
              <p>TO HAVE AND TO HOLD, the same in fee simple forever.</p>
              <p>AND the Grantor hereby covenants with said Grantee that the Grantor is lawfully seized of said land in fee simple; that the Grantor has good right and lawful authority to sell and convey said land; that the Grantor hereby fully warrants the title to said land and will defend the same against the lawful claims of all persons whomsoever; and that said land is free of all encumbrances, except taxes accruing subsequent to December 31, 2023.</p>
            </div>

            {/* Signature Area */}
            <div className="mt-12 grid grid-cols-2 gap-12">
              <div>
                <p className="text-sm font-serif mb-8">IN WITNESS WHEREOF, the said Grantor has signed and sealed these presents the day and year first above written.</p>
                <div className="border-b-2 border-black relative h-12 mb-2">
                  {/* Draggable Signature Placeholder */}
                  <div className="absolute bottom-1 left-4 border-2 border-dashed border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)] px-4 py-2 rounded-[var(--st-radius)] text-xs font-semibold flex items-center gap-2 cursor-move">
                    <PenTool size={14} aria-hidden="true" />
                    Grantor Signature Required
                  </div>
                </div>
                <p className="text-sm font-serif">Eleanor Shellstrop, Grantor</p>
              </div>

              <div>
                <p className="text-sm font-serif mb-8">STATE OF ARIZONA<br />COUNTY OF MARICOPA</p>
                <p className="text-sm font-serif mb-4">The foregoing instrument was acknowledged before me by means of online notarization this 12th day of May, 2024, by Eleanor Shellstrop.</p>
                <div className="border-b-2 border-black relative h-12 mb-2">
                  {/* Draggable Notary Seal Placeholder */}
                  <div className="absolute bottom-1 left-4 border-2 border-dashed border-[var(--st-accent)] bg-[var(--st-accent-soft)] text-[var(--st-accent)] px-4 py-2 rounded-[var(--st-radius)] text-xs font-semibold flex items-center gap-2 cursor-move">
                    <Stamp size={14} aria-hidden="true" />
                    Place Digital Seal Here
                  </div>
                </div>
                <p className="text-sm font-serif">Notary Public</p>
              </div>
            </div>
          </div>

          {/* Floating Tools Palette */}
          <Card variant="elevated" padding="sm" className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2">
            <IconButton label="Add signature field" icon={PenTool} variant="ghost" />
            <IconButton label="Place notary seal" icon={Stamp} variant="ghost" />
            <IconButton label="Add date field" icon={Calendar} variant="ghost" />
            <div className="w-full h-px bg-[var(--st-border)] my-1" />
            <IconButton label="Complete notarization" icon={CheckCircle} variant="ghost" />
          </Card>
        </div>
      </Card>

      {/* Chat & Sidebar */}
      {chatOpen && (
        <Card variant="elevated" padding="none" className="w-80 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--st-border)] flex items-center justify-between bg-[var(--st-bg-secondary)]">
            <h3 className="font-semibold flex items-center gap-2 text-[var(--st-text)]">
              <MessageSquare size={18} className="text-[var(--st-accent)]" aria-hidden="true" />
              Session Chat
            </h3>
            <IconButton label="Close session chat" icon={X} variant="ghost" size="sm" onClick={() => setChatOpen(false)} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {MOCK_MESSAGES.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender.includes('You') ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-[var(--st-text-secondary)] mb-1 px-1">{msg.sender}, {msg.time}</span>
                <div
                  className={`px-4 py-2 rounded-[var(--st-radius-lg)] max-w-[85%] text-sm ${
                    msg.sender.includes('You')
                      ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)] rounded-tr-sm'
                      : 'bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-[var(--st-border)]">
            <Input
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Type a message..."
              aria-label="Type a message"
              iconRight={Send}
            />
          </div>

          {/* Session Info Panel below chat */}
          <div className="p-4 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
            <h4 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3">Session Details</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} className="text-[var(--st-status-ok)]" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium text-[var(--st-text)]">ID Verified</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">KBA + Biometric matched</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-[var(--st-accent)]" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-medium text-[var(--st-text)]">IP Logged</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">192.168.1.45 (US)</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

const IDVerification = () => {
  const { toast } = useToast();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'idle' | 'success' | 'failed'>('idle');

  const simulateVerification = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerificationResult('success');
      toast.success('Identity verified successfully');
    }, 3000);
  };

  type Capture = {
    image: string | null;
    setImage: (url: string | null) => void;
    icon: typeof CreditCard;
    title: string;
    hint: string;
    captureLabel: string;
    pickLabel: string;
  };

  const captures: Capture[] = [
    { image: frontImage, setImage: setFrontImage, icon: CreditCard, title: 'Front of ID', hint: 'Upload a clear photo of the front of the ID.', captureLabel: 'Front captured', pickLabel: 'Select front image' },
    { image: backImage, setImage: setBackImage, icon: FileArchive, title: 'Back of ID', hint: 'Barcode or MRZ must be clearly visible.', captureLabel: 'Back captured', pickLabel: 'Select back image' },
    { image: selfie, setImage: setSelfie, icon: Camera, title: 'Live Selfie', hint: 'Used for biometric face match against the ID.', captureLabel: 'Selfie captured', pickLabel: 'Select selfie image' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Card variant="elevated" padding="lg">
        <CardBody>
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-[var(--st-text)] flex items-center gap-3">
                <Shield className="text-[var(--st-accent)]" aria-hidden="true" />
                Identity Verification
              </h2>
              <p className="text-[var(--st-text-secondary)] mt-1">Capture and verify signer identity using credential analysis and biometrics.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => toast.info('Verification request sent to signer')}>
                Request from Signer
              </Button>
              <Button
                variant="primary"
                onClick={simulateVerification}
                disabled={!frontImage || !backImage || !selfie}
                loading={verifying}
                iconLeft={verifying ? undefined : CheckCircle}
              >
                {verifying ? 'Analyzing...' : 'Run Verification'}
              </Button>
            </div>
          </div>

          {/* Status Alert */}
          {verificationResult === 'success' && (
            <Alert tone="success" title="Identity Verified Successfully" className="mb-8">
              Credential analysis passed. Biometric face match confidence: 99.2%. Document is valid and has not expired.
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {captures.map((c) => (
              <div
                key={c.title}
                className={`border-2 border-dashed rounded-[var(--st-radius-lg)] p-6 flex flex-col items-center justify-center min-h-[300px] transition-all relative overflow-hidden ${
                  c.image
                    ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                    : 'border-[var(--st-border-strong)] hover:border-[var(--st-accent)] bg-[var(--st-bg-secondary)]'
                }`}
              >
                {c.image ? (
                  <>
                    <img src={c.image} alt={c.title} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                      <span className="text-white font-medium text-sm flex items-center gap-2">
                        <CheckCircle size={16} className="text-[var(--st-status-ok)]" aria-hidden="true" /> {c.captureLabel}
                      </span>
                      <IconButton label={`Remove ${c.title}`} icon={Trash2} variant="danger" size="sm" onClick={() => c.setImage(null)} />
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[var(--st-accent-soft)] text-[var(--st-accent)] rounded-full flex items-center justify-center mx-auto mb-4">
                      <c.icon size={32} aria-hidden="true" />
                    </div>
                    <h3 className="font-semibold text-[var(--st-text)] mb-2">{c.title}</h3>
                    <p className="text-sm text-[var(--st-text-secondary)] px-4">{c.hint}</p>
                    <SabFilePickerButton
                      accept="image"
                      className="mt-6"
                      onPick={(pick) => c.setImage(pick.url)}
                    >
                      {c.pickLabel}
                    </SabFilePickerButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Advanced Verification Logs */}
      <Card variant="elevated" padding="lg">
        <CardBody>
          <h3 className="text-lg font-bold text-[var(--st-text)] mb-6 flex items-center gap-2">
            <Fingerprint className="text-[var(--st-text-secondary)]" aria-hidden="true" />
            Technical Analysis Log
          </h3>
          <div className="bg-[var(--st-text)] rounded-[var(--st-radius-lg)] p-4 font-mono text-sm text-[var(--st-text-inverted)] h-64 overflow-y-auto">
            {verifying ? (
              <div className="flex flex-col gap-2">
                <span>{'>'} INITIALIZING CREDENTIAL ANALYSIS MODULE...</span>
                <span>{'>'} EXTRACTING BARCODE DATA...</span>
              </div>
            ) : verificationResult === 'success' ? (
              <div className="flex flex-col gap-2">
                <span>{'>'} INITIALIZING CREDENTIAL ANALYSIS MODULE... [OK]</span>
                <span>{'>'} EXTRACTING BARCODE DATA... [OK]</span>
                <span>{'>'} VALIDATING SECURITY FEATURES (HOLOGRAMS, MICROPRINT)... [PASSED]</span>
                <span>{'>'} CROSS-REFERENCING ISSUING AUTHORITY DATABASE... [MATCH FOUND]</span>
                <span>{'>'} ANALYZING LIVE SELFIE BIOMETRICS... [OK]</span>
                <span>{'>'} COMPARING SELFIE VECTORS TO DOCUMENT PORTRAIT... [CONFIDENCE: 99.23%]</span>
                <span>{'>'} PERFORMING LIVENESS DETECTION (3D DEPTH)... [PASSED]</span>
                <span className="mt-4">{'>'} FINAL DETERMINATION: AUTHENTICATED</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <span>{'>'} WAITING FOR INPUT MEDIA...</span>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const NotaryJournal = () => {
  const { toast } = useToast();

  return (
    <Card variant="elevated" padding="none" className="overflow-hidden">
      {/* Toolbar */}
      <div className="p-6 border-b border-[var(--st-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--st-text)] flex items-center gap-3">
            <FileArchive className="text-[var(--st-accent)]" aria-hidden="true" />
            Digital Notary Journal
          </h2>
          <p className="text-[var(--st-text-secondary)] mt-1">Legally compliant electronic record of all notarization acts.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Search entries..." aria-label="Search journal entries" iconLeft={Search} className="w-full md:w-64" />

          <Button variant="outline" iconLeft={Filter}>Filter</Button>
          <Button variant="outline" iconLeft={Download} onClick={() => toast.success('Journal exported to CSV')}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {MOCK_JOURNAL_ENTRIES.length === 0 ? (
          <EmptyState
            icon={FileArchive}
            title="No journal entries yet"
            description="Completed notarization acts will be recorded here."
          />
        ) : (
          <Table hover>
            <THead>
              <Tr>
                <Th>Entry ID & Date</Th>
                <Th>Signer</Th>
                <Th>Document Type</Th>
                <Th>ID Method</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {MOCK_JOURNAL_ENTRIES.map((entry) => (
                <Tr key={entry.id}>
                  <Td>
                    <div className="font-medium text-[var(--st-text)]">{entry.id}</div>
                    <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-1 mt-1">
                      <Clock size={12} aria-hidden="true" /> {new Date(entry.date).toLocaleString()}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.signer} size="md" shape="round" />
                      <div>
                        <div className="font-medium text-[var(--st-text)]">{entry.signer}</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">{entry.location}, {entry.ip}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2 text-sm text-[var(--st-text)]">
                      <FileText size={16} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                      {entry.type}
                    </div>
                  </Td>
                  <Td>
                    <div className="text-sm text-[var(--st-text)] flex items-center gap-2">
                      <ShieldCheck
                        size={14}
                        className={entry.idMethod === 'Failed' ? 'text-[var(--st-danger)]' : 'text-[var(--st-status-ok)]'}
                        aria-hidden="true"
                      />
                      {entry.idMethod}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={journalStatusTone(entry.status)} kind="soft">{entry.status}</Badge>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label={`View ${entry.id}`} icon={Eye} variant="ghost" size="sm" />
                      <IconButton label={`More actions for ${entry.id}`} icon={MoreVertical} variant="ghost" size="sm" />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-[var(--st-border)] flex items-center justify-between text-sm text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)]">
        <div>Showing 1 to 7 of 42 entries</div>
        <div className="flex gap-1 items-center">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="primary" size="sm">1</Button>
          <Button variant="outline" size="sm">2</Button>
          <Button variant="outline" size="sm">3</Button>
          <span className="px-2 py-1 text-[var(--st-text-tertiary)]">...</span>
          <Button variant="outline" size="sm">Next</Button>
        </div>
      </div>
    </Card>
  );
};

const DigitalSeal = () => {
  const { toast } = useToast();
  const [requirePin, setRequirePin] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card variant="elevated" padding="lg">
        <CardBody>
          <h2 className="text-2xl font-bold text-[var(--st-text)] mb-2 flex items-center gap-3">
            <FileKey className="text-[var(--st-accent)]" aria-hidden="true" />
            Digital Certificate & Seal
          </h2>
          <p className="text-[var(--st-text-secondary)] mb-8">Manage your X.509 digital certificate and electronic notary seal appearance.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Certificate Info */}
            <div className="space-y-6">
              <Card variant="outlined" padding="lg" className="bg-[var(--st-accent-soft)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[var(--st-bg)] rounded-[var(--st-radius)] text-[var(--st-accent)]">
                    <Shield size={24} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--st-text)]">Active Digital Certificate</h3>
                    <p className="text-sm text-[var(--st-text-secondary)]">Valid until Dec 31, 2025</p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Issued To:</span>
                    <span className="font-medium text-[var(--st-text)]">Jane Notary Doe</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Issued By:</span>
                    <span className="font-medium text-[var(--st-text)]">IdenTrust Global Common</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Serial Number:</span>
                    <span className="font-mono text-xs text-[var(--st-text)]">01:23:45:67:89:AB:CD:EF</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--st-text-secondary)]">Key Usage:</span>
                    <span className="font-medium text-[var(--st-text)]">Digital Signature, Non-Repudiation</span>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button variant="outline" block onClick={() => toast.info('Opening certificate details')}>
                    View Certificate
                  </Button>
                  <Button variant="primary" block onClick={() => toast.success('Certificate renewal requested')}>
                    Renew
                  </Button>
                </div>
              </Card>

              <Card variant="outlined" padding="lg" className="bg-[var(--st-bg-secondary)]">
                <h3 className="font-semibold text-[var(--st-text)] mb-4 flex items-center gap-2">
                  <Lock size={18} className="text-[var(--st-text-tertiary)]" aria-hidden="true" /> Security Settings
                </h3>
                <div className="space-y-4">
                  <Switch
                    checked={requirePin}
                    onCheckedChange={setRequirePin}
                    label="Require PIN for every notarization"
                  />
                  <Switch
                    checked={includeLocation}
                    onCheckedChange={setIncludeLocation}
                    label="Include location data in audit trail"
                  />
                </div>
              </Card>
            </div>

            {/* Seal Appearance */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-[var(--st-text)] mb-4">Seal Preview</h3>
                <div className="bg-[var(--st-bg-muted)] rounded-[var(--st-radius-lg)] p-8 flex items-center justify-center border border-[var(--st-border)] min-h-[250px] relative overflow-hidden">
                  {/* Simulated Seal Design */}
                  <div className="relative w-48 h-48 rounded-full border-4 border-[var(--st-accent)] flex items-center justify-center bg-white shadow-[var(--st-shadow-sm)] p-2">
                    <div className="absolute inset-2 border border-[var(--st-accent)] rounded-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full uppercase tracking-widest text-[8px] font-bold" fill="var(--st-accent)" aria-hidden="true">
                        <path id="curve" d="M 50 10 A 40 40 0 1 1 49.9 10" fill="transparent" />
                        <text><textPath href="#curve" startOffset="5%">NOTARY PUBLIC . STATE OF ARIZONA</textPath></text>
                      </svg>
                    </div>
                    <div className="text-center z-10 flex flex-col items-center">
                      <Shield className="text-[var(--st-accent)] mb-1" size={24} aria-hidden="true" />
                      <div className="font-serif font-bold text-[var(--st-text)] text-sm leading-tight">JANE DOE</div>
                      <div className="text-[8px] text-[var(--st-text-secondary)] mt-1">COMM. #123456</div>
                      <div className="text-[8px] text-[var(--st-text-secondary)]">EXP. 12/31/2025</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SabFilePickerButton
                  accept="image"
                  variant="outline"
                  className="w-full"
                  onPick={() => toast.success('Custom seal uploaded')}
                >
                  <UploadCloud aria-hidden="true" /> Upload Custom PNG
                </SabFilePickerButton>
                <Button variant="primary" iconLeft={Settings} onClick={() => toast.info('Generating a new seal')}>
                  Generate New
                </Button>
              </div>

              <Alert tone="info" icon={AlertCircle}>
                Your digital seal is cryptographically bound to your digital certificate. Any modifications to a document after placing this seal will invalidate the signature.
              </Alert>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---

type NotaryTab = 'live' | 'verification' | 'journal' | 'seal';

export default function SabSignNotaryPage() {
  const [activeTab, setActiveTab] = useState<NotaryTab>('live');

  const tabs = [
    { value: 'live' as const, label: 'Live Session', icon: Video },
    { value: 'verification' as const, label: 'ID Verification', icon: UserCheck },
    { value: 'journal' as const, label: 'Notary Journal', icon: FileArchive },
    { value: 'seal' as const, label: 'Digital Seal', icon: Stamp },
  ];

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg-secondary)] p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <PageHeader>
          <PageHeaderHeading>
            <PageEyebrow className="flex items-center gap-2">
              <span className="p-1.5 bg-[var(--st-accent)] rounded-[var(--st-radius)] text-[var(--st-text-inverted)] inline-flex">
                <FileSignature size={16} aria-hidden="true" />
              </span>
              SabSign RON
            </PageEyebrow>
            <PageTitle>Remote Online Notarization</PageTitle>
            <PageDescription>Run live sessions, verify signer identity, and manage your notary journal and seal.</PageDescription>
          </PageHeaderHeading>

          <PageActions>
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider">Status</span>
                <span className="flex items-center gap-2 mt-1 text-sm font-semibold text-[var(--st-text)]">
                  <Dot tone="success" pulse aria-label="Online and ready" />
                  Online & Ready
                </span>
              </div>
              <div className="w-px h-8 bg-[var(--st-border)]" />
              <div className="flex flex-col">
                <span className="text-xs text-[var(--st-text-secondary)] font-medium uppercase tracking-wider">Today</span>
                <span className="text-sm font-semibold text-[var(--st-text)]">4 Notarizations</span>
              </div>
              <div className="w-px h-8 bg-[var(--st-border)]" />
              <Avatar name="Jane Doe" initials="JD" size="lg" shape="round" />
            </div>
          </PageActions>
        </PageHeader>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="mb-6 overflow-x-auto pb-2">
          <SegmentedControl
            aria-label="Notary workspace section"
            items={tabs.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
            value={activeTab}
            onChange={(v) => setActiveTab(v as NotaryTab)}
          />
        </div>

        {/* Active Content Area */}
        <div className="relative">
          {activeTab === 'live' && <LiveSession />}
          {activeTab === 'verification' && <IDVerification />}
          {activeTab === 'journal' && <NotaryJournal />}
          {activeTab === 'seal' && <DigitalSeal />}
        </div>
      </div>
    </div>
  );
}
