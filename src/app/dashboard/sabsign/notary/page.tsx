'use client';

import React, { useState, useRef } from 'react';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Users,
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
  Check,
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
  LayoutGrid,
  FileArchive,
  RefreshCw
} from 'lucide-react';

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
  { sender: 'Eleanor (Signer)', text: 'Hi! Yes, I have my driver\'s license ready.', time: '10:01 AM' },
  { sender: 'Notary (You)', text: 'Great. Let\'s proceed with the ID verification first.', time: '10:02 AM' },
];

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
        <div className="relative flex-1 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex items-center justify-center">
          {/* Main Video (Signer) */}
          <div className="absolute inset-0 flex items-center justify-center">
            {videoOn ? (
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800" alt="Signer" className="w-full h-full object-cover opacity-80" />
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                  <UserCheck size={40} className="text-neutral-500" />
                </div>
                <p className="text-neutral-400">Signer Camera Off</p>
              </div>
            )}
            {/* Status Overlay */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-xs font-medium text-white">REC</span>
              <span className="text-xs text-neutral-300 ml-2 border-l border-white/20 pl-2">04:23</span>
            </div>
            {/* Signer Name Overlay */}
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-sm font-medium text-white">Eleanor Shellstrop (Signer)</span>
            </div>
          </div>

          {/* Picture in Picture (Notary) */}
          <div className="absolute bottom-4 right-4 w-32 h-48 bg-neutral-800 rounded-xl overflow-hidden border-2 border-neutral-700 shadow-lg">
            <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=300" alt="Notary" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white">
              You
            </div>
          </div>
        </div>

        {/* Video Controls */}
        <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 flex items-center justify-center gap-4 shadow-sm">
          <button onClick={() => setMicOn(!micOn)} className={`p-4 rounded-full transition-colors ${micOn ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'}`}>
            {micOn ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button onClick={() => setVideoOn(!videoOn)} className={`p-4 rounded-full transition-colors ${videoOn ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'}`}>
            {videoOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
          <button className="p-4 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition-colors">
            <MonitorUp size={24} />
          </button>
          <button onClick={() => setChatOpen(!chatOpen)} className={`p-4 rounded-full transition-colors ${chatOpen ? 'bg-blue-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}>
            <MessageSquare size={24} />
          </button>
          <button className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors ml-4 shadow-lg shadow-red-600/20">
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Document & Tools Side */}
      <div className={`flex flex-col flex-1 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm transition-all duration-300`}>
        {/* Document Header */}
        <div className="h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 bg-neutral-50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">Warranty_Deed_Final.pdf</h3>
              <p className="text-xs text-neutral-500">Page {documentPage} of 5</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDocumentPage(Math.max(1, documentPage - 1))} className="p-2 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-50" disabled={documentPage === 1}>
              <ChevronDown size={20} className="rotate-90" />
            </button>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{documentPage} / 5</span>
            <button onClick={() => setDocumentPage(Math.min(5, documentPage + 1))} className="p-2 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg disabled:opacity-50" disabled={documentPage === 5}>
              <ChevronDown size={20} className="-rotate-90" />
            </button>
            <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-2"></div>
            <button className="p-2 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg flex items-center gap-2 text-sm font-medium">
              <Maximize size={18} />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          </div>
        </div>

        {/* Document Viewer Area */}
        <div className="flex-1 relative bg-neutral-100 dark:bg-neutral-950 overflow-auto p-4 md:p-8 flex justify-center">
          {/* Mock Document Page */}
          <div className="w-full max-w-3xl bg-white aspect-[8.5/11] shadow-xl rounded border border-neutral-200 relative p-12 flex flex-col">
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
                  <div className="absolute bottom-1 left-4 border-2 border-dashed border-blue-500 bg-blue-500/10 text-blue-700 px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-move animate-pulse">
                    <PenTool size={14} />
                    Grantor Signature Required
                  </div>
                </div>
                <p className="text-sm font-serif">Eleanor Shellstrop, Grantor</p>
              </div>

              <div>
                <p className="text-sm font-serif mb-8">STATE OF ARIZONA<br/>COUNTY OF MARICOPA</p>
                <p className="text-sm font-serif mb-4">The foregoing instrument was acknowledged before me by means of online notarization this 12th day of May, 2024, by Eleanor Shellstrop.</p>
                <div className="border-b-2 border-black relative h-12 mb-2">
                  {/* Draggable Notary Seal Placeholder */}
                  <div className="absolute bottom-1 left-4 border-2 border-dashed border-purple-500 bg-purple-500/10 text-purple-700 px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 cursor-move">
                    <Stamp size={14} />
                    Place Digital Seal Here
                  </div>
                </div>
                <p className="text-sm font-serif">Notary Public</p>
              </div>
            </div>
          </div>

          {/* Floating Tools Palette */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-2 flex flex-col gap-2">
            <button className="p-3 text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors tooltip" title="Add Signature Field">
              <PenTool size={20} />
            </button>
            <button className="p-3 text-neutral-600 dark:text-neutral-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors tooltip" title="Place Notary Seal">
              <Stamp size={20} />
            </button>
            <button className="p-3 text-neutral-600 dark:text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors tooltip" title="Add Date Field">
              <Calendar size={20} />
            </button>
            <div className="w-full h-px bg-neutral-200 dark:bg-neutral-700 my-1"></div>
            <button className="p-3 text-neutral-600 dark:text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-colors tooltip" title="Complete Notarization">
              <CheckCircle size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Chat & Sidebar */}
      {chatOpen && (
        <div className="w-80 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
            <h3 className="font-semibold flex items-center gap-2 dark:text-white">
              <MessageSquare size={18} className="text-blue-500" />
              Session Chat
            </h3>
            <button onClick={() => setChatOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
              <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {MOCK_MESSAGES.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender.includes('You') ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-neutral-500 mb-1 px-1">{msg.sender} • {msg.time}</span>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.sender.includes('You') ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-tl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
            <div className="relative">
              <input 
                type="text" 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..." 
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-full pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 dark:text-white outline-none"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors">
                <Check size={16} />
              </button>
            </div>
          </div>

          {/* Session Info Panel below chat */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800">
            <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Session Details</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} className="text-green-500" />
                <div className="text-sm">
                  <p className="font-medium dark:text-white">ID Verified</p>
                  <p className="text-xs text-neutral-500">KBA + Biometric matched</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-blue-500" />
                <div className="text-sm">
                  <p className="font-medium dark:text-white">IP Logged</p>
                  <p className="text-xs text-neutral-500">192.168.1.45 (US)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IDVerification = () => {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'idle'|'success'|'failed'>('idle');

  const handleDrop = (e: React.DragEvent, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    e.preventDefault();
    // Mocking file drop with an Unsplash image for demo
    setter("https://images.unsplash.com/photo-1628151015968-3a4429e9ef04?auto=format&fit=crop&q=80&w=400");
  };

  const simulateVerification = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setVerificationResult('success');
    }, 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold dark:text-white flex items-center gap-3">
              <Shield className="text-blue-500" />
              Identity Verification
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">Capture and verify signer identity using credential analysis and biometrics.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
              Request from Signer
            </button>
            <button 
              onClick={simulateVerification}
              disabled={!frontImage || !backImage || !selfie || verifying}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {verifying ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              {verifying ? 'Analyzing...' : 'Run Verification'}
            </button>
          </div>
        </div>

        {/* Status Alert */}
        {verificationResult === 'success' && (
          <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
            <ShieldCheck className="text-green-600 dark:text-green-400 mt-0.5" />
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-300">Identity Verified Successfully</h4>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">Credential analysis passed. Biometric face match confidence: 99.2%. Document is valid and has not expired.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Front of ID */}
          <div 
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] transition-all relative overflow-hidden ${frontImage ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-neutral-300 dark:border-neutral-700 hover:border-blue-400 dark:hover:border-blue-500 bg-neutral-50 dark:bg-neutral-800/50'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, setFrontImage)}
          >
            {frontImage ? (
              <>
                <img src={frontImage} alt="ID Front" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                  <span className="text-white font-medium text-sm flex items-center gap-2"><CheckCircle size={16} className="text-green-400"/> Front Captured</span>
                  <button onClick={() => setFrontImage(null)} className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors"><Trash2 size={14} /></button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard size={32} />
                </div>
                <h3 className="font-semibold dark:text-white mb-2">Front of ID</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 px-4">Drag and drop image here or click to upload</p>
                <button className="mt-6 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm font-medium dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  Select File
                </button>
              </div>
            )}
          </div>

          {/* Back of ID */}
          <div 
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] transition-all relative overflow-hidden ${backImage ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-neutral-300 dark:border-neutral-700 hover:border-blue-400 dark:hover:border-blue-500 bg-neutral-50 dark:bg-neutral-800/50'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, setBackImage)}
          >
            {backImage ? (
              <>
                <img src={backImage} alt="ID Back" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                  <span className="text-white font-medium text-sm flex items-center gap-2"><CheckCircle size={16} className="text-green-400"/> Back Captured</span>
                  <button onClick={() => setBackImage(null)} className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors"><Trash2 size={14} /></button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileArchive size={32} />
                </div>
                <h3 className="font-semibold dark:text-white mb-2">Back of ID</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 px-4">Barcode or MRZ must be clearly visible</p>
                <button className="mt-6 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm font-medium dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  Select File
                </button>
              </div>
            )}
          </div>

          {/* Selfie */}
          <div 
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] transition-all relative overflow-hidden ${selfie ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-neutral-300 dark:border-neutral-700 hover:border-purple-400 dark:hover:border-purple-500 bg-neutral-50 dark:bg-neutral-800/50'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, setSelfie)}
          >
            {selfie ? (
              <>
                <img src={selfie} alt="Selfie" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
                  <span className="text-white font-medium text-sm flex items-center gap-2"><CheckCircle size={16} className="text-green-400"/> Selfie Captured</span>
                  <button onClick={() => setSelfie(null)} className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors"><Trash2 size={14} /></button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Camera size={32} />
                </div>
                <h3 className="font-semibold dark:text-white mb-2">Live Selfie</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 px-4">Used for biometric face match against ID</p>
                <button className="mt-6 px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm font-medium dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                  Take Photo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Verification Logs */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
        <h3 className="text-lg font-bold dark:text-white mb-6 flex items-center gap-2">
          <Fingerprint className="text-neutral-500" />
          Technical Analysis Log
        </h3>
        <div className="bg-neutral-950 rounded-xl p-4 font-mono text-sm text-neutral-400 h-64 overflow-y-auto">
          {verifying ? (
            <div className="flex flex-col gap-2">
              <span className="text-blue-400">{'>'} INITIALIZING CREDENTIAL ANALYSIS MODULE...</span>
              <span className="text-blue-400 animate-pulse">{'>'} EXTRACTING BARCODE DATA...</span>
            </div>
          ) : verificationResult === 'success' ? (
            <div className="flex flex-col gap-2">
              <span>{'>'} INITIALIZING CREDENTIAL ANALYSIS MODULE... [OK]</span>
              <span>{'>'} EXTRACTING BARCODE DATA... [OK]</span>
              <span>{'>'} VALIDATING SECURITY FEATURES (HOLOGRAMS, MICROPRINT)... <span className="text-green-400">[PASSED]</span></span>
              <span>{'>'} CROSS-REFERENCING ISSUING AUTHORITY DATABASE... <span className="text-green-400">[MATCH FOUND]</span></span>
              <span>{'>'} ANALYZING LIVE SELFIE BIOMETRICS... [OK]</span>
              <span>{'>'} COMPARING SELFIE VECTORS TO DOCUMENT PORTRAIT... <span className="text-green-400">[CONFIDENCE: 99.23%]</span></span>
              <span>{'>'} PERFORMING LIVENESS DETECTION (3D DEPTH)... <span className="text-green-400">[PASSED]</span></span>
              <span className="text-white mt-4">{'>'} FINAL DETERMINATION: <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded">AUTHENTICATED</span></span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span>{'>'} WAITING FOR INPUT MEDIA...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NotaryJournal = () => {
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold dark:text-white flex items-center gap-3">
            <FileArchive className="text-purple-500" />
            Digital Notary Journal
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Legally compliant electronic record of all notarization acts.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text" 
              placeholder="Search entries..." 
              className="pl-10 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-transparent focus:border-purple-500 rounded-lg text-sm dark:text-white outline-none w-full md:w-64 transition-colors"
            />
          </div>
          <button className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium dark:text-white flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <Filter size={16} /> Filter
          </button>
          <button className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium dark:text-white flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
              <th className="p-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Entry ID & Date</th>
              <th className="p-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Signer</th>
              <th className="p-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Document Type</th>
              <th className="p-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">ID Method</th>
              <th className="p-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
              <th className="p-4 font-semibold text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {MOCK_JOURNAL_ENTRIES.map((entry) => (
              <tr key={entry.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
                <td className="p-4">
                  <div className="font-medium text-neutral-900 dark:text-white">{entry.id}</div>
                  <div className="text-xs text-neutral-500 flex items-center gap-1 mt-1">
                    <Clock size={12} /> {new Date(entry.date).toLocaleString()}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                      {entry.signer.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">{entry.signer}</div>
                      <div className="text-xs text-neutral-500">{entry.location} • {entry.ip}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <FileText size={16} className="text-neutral-400" />
                    {entry.type}
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <ShieldCheck size={14} className={entry.idMethod === 'Failed' ? 'text-red-500' : 'text-green-500'} />
                    {entry.idMethod}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    entry.status === 'Completed' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30' :
                    entry.status === 'Pending' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30' :
                    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30'
                  }`}>
                    {entry.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="p-2 text-neutral-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors opacity-0 group-hover:opacity-100">
                    <Eye size={18} />
                  </button>
                  <button className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors ml-1">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50">
        <div>Showing 1 to 7 of 42 entries</div>
        <div className="flex gap-1">
          <button className="px-3 py-1 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50" disabled>Previous</button>
          <button className="px-3 py-1 bg-purple-600 text-white rounded-md">1</button>
          <button className="px-3 py-1 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">2</button>
          <button className="px-3 py-1 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">3</button>
          <span className="px-2 py-1">...</span>
          <button className="px-3 py-1 border border-neutral-200 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">Next</button>
        </div>
      </div>
    </div>
  );
};

const DigitalSeal = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 shadow-sm">
        <h2 className="text-2xl font-bold dark:text-white mb-2 flex items-center gap-3">
          <FileKey className="text-orange-500" />
          Digital Certificate & Seal
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">Manage your X.509 digital certificate and electronic notary seal appearance.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Certificate Info */}
          <div className="space-y-6">
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg text-orange-600 dark:text-orange-400">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-orange-900 dark:text-orange-300">Active Digital Certificate</h3>
                  <p className="text-sm text-orange-700 dark:text-orange-400/80">Valid until Dec 31, 2025</p>
                </div>
              </div>
              
              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Issued To:</span>
                  <span className="font-medium dark:text-white">Jane Notary Doe</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Issued By:</span>
                  <span className="font-medium dark:text-white">IdenTrust Global Common</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Serial Number:</span>
                  <span className="font-mono text-xs dark:text-neutral-300">01:23:45:67:89:AB:CD:EF</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Key Usage:</span>
                  <span className="font-medium dark:text-white">Digital Signature, Non-Repudiation</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button className="flex-1 px-4 py-2 bg-white dark:bg-neutral-800 border border-orange-200 dark:border-orange-700 rounded-lg text-sm font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors">
                  View Certificate
                </button>
                <button className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors">
                  Renew
                </button>
              </div>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50 rounded-xl p-6">
               <h3 className="font-semibold dark:text-white mb-4 flex items-center gap-2"><Lock size={18} className="text-neutral-400"/> Security Settings</h3>
               <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium dark:text-neutral-200">Require PIN for every notarization</span>
                    <div className="relative inline-flex items-center h-6 rounded-full w-11 bg-orange-500">
                      <span className="translate-x-6 inline-block w-4 h-4 transform bg-white rounded-full transition"/>
                    </div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-medium dark:text-neutral-200">Include location data in audit trail</span>
                    <div className="relative inline-flex items-center h-6 rounded-full w-11 bg-orange-500">
                      <span className="translate-x-6 inline-block w-4 h-4 transform bg-white rounded-full transition"/>
                    </div>
                  </label>
               </div>
            </div>
          </div>

          {/* Seal Appearance */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold dark:text-white mb-4">Seal Preview</h3>
              <div className="bg-neutral-100 dark:bg-neutral-800/50 rounded-xl p-8 flex items-center justify-center border border-neutral-200 dark:border-neutral-700/50 min-h-[250px] relative overflow-hidden group">
                
                {/* Simulated Seal Design */}
                <div className="relative w-48 h-48 rounded-full border-4 border-orange-600 flex items-center justify-center bg-white shadow-sm p-2 transform group-hover:scale-105 transition-transform duration-500">
                  <div className="absolute inset-2 border border-orange-600 rounded-full"></div>
                  <div className="absolute inset-0 flex items-center justify-center animate-[spin_60s_linear_infinite]">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-orange-800 uppercase tracking-widest text-[8px] font-bold fill-current">
                      <path id="curve" d="M 50 10 A 40 40 0 1 1 49.9 10" fill="transparent" />
                      <text><textPath href="#curve" startOffset="5%">★ NOTARY PUBLIC ★ STATE OF ARIZONA ★</textPath></text>
                    </svg>
                  </div>
                  <div className="text-center z-10 flex flex-col items-center">
                    <Shield className="text-orange-600 mb-1" size={24} />
                    <div className="font-serif font-bold text-orange-900 text-sm leading-tight">JANE DOE</div>
                    <div className="text-[8px] text-orange-700 font-sans mt-1">COMM. #123456</div>
                    <div className="text-[8px] text-orange-700 font-sans">EXP. 12/31/2025</div>
                  </div>
                </div>

              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center justify-center gap-2 p-4 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                <UploadCloud className="text-neutral-400" />
                <span className="text-sm font-medium dark:text-white">Upload Custom PNG</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-4 border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/10 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors">
                <Settings className="text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">Generate New</span>
              </button>
            </div>
            
            <div className="text-sm text-neutral-500 dark:text-neutral-400 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex gap-3">
              <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
              <p>Your digital seal is cryptographically bound to your digital certificate. Any modifications to a document after placing this seal will invalidate the signature.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- MAIN PAGE COMPONENT ---

export default function SabSignNotaryPage() {
  const [activeTab, setActiveTab] = useState<'live'|'journal'|'verification'|'seal'>('live');

  const tabs = [
    { id: 'live', label: 'Live Session', icon: Video },
    { id: 'verification', label: 'ID Verification', icon: UserCheck },
    { id: 'journal', label: 'Notary Journal', icon: FileArchive },
    { id: 'seal', label: 'Digital Seal', icon: Stamp },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-600/20">
              <FileSignature size={24} />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">SabSign RON</h1>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg">Remote Online Notarization Dashboard</p>
        </div>

        {/* Global Stats/Status */}
        <div className="flex items-center gap-6 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">Status</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-semibold dark:text-white">Online & Ready</span>
            </div>
          </div>
          <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800"></div>
          <div className="flex flex-col">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">Today</span>
            <span className="text-sm font-semibold dark:text-white">4 Notarizations</span>
          </div>
          <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800"></div>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold border border-orange-200 dark:border-orange-800">JD</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive 
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm border border-neutral-200 dark:border-neutral-800' 
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
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
