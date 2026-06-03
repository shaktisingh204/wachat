"use client";

import React, { useState } from 'react';
import { 
  Building, 
  Palette, 
  Scale, 
  ShieldCheck, 
  Settings, 
  UploadCloud, 
  Lock, 
  Save, 
  AlertCircle,
  Clock,
  Globe,
  Bell,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  Key,
  FileText,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Server,
  Activity,
  HardDrive,
  Cpu,
  Shield,
  Zap
} from 'lucide-react';

const tabs = [
  { id: 'general', name: 'General Settings', icon: Settings, description: 'Core application preferences' },
  { id: 'branding', name: 'Corporate Branding', icon: Palette, description: 'White-labeling and visual identity' },
  { id: 'legal', name: 'Legal & Disclosures', icon: Scale, description: 'Compliance texts and terms' },
  { id: 'security', name: 'Security & Auth', icon: ShieldCheck, description: 'Access control and policies' },
  { id: 'advanced', name: 'System Configs', icon: Server, description: 'Webhooks, APIs and integrations' },
];

// MOCK DATA
const initialIpWhitelist = [
  { id: 1, ip: '192.168.1.1', label: 'Corporate Office - NY', addedBy: 'admin@zoru.ui', date: '2026-01-15' },
  { id: 2, ip: '10.0.0.55', label: 'VPN Gateway', addedBy: 'secops@zoru.ui', date: '2026-02-22' },
  { id: 3, ip: '172.16.254.1', label: 'Remote Backup Server', addedBy: 'devops@zoru.ui', date: '2026-03-10' },
];

const mockWebhooks = [
  { id: 1, url: 'https://api.acme.com/sabsign/events', events: ['envelope.signed', 'envelope.declined'], status: 'active', lastFired: '10 mins ago' },
  { id: 2, url: 'https://hooks.slack.com/services/invalid/webhook/placeholder', events: ['envelope.created'], status: 'failing', lastFired: '2 hrs ago' },
];

export default function SabSignSettingsPage() {
  const [activeTab, setActiveTab] = useState('branding');
  const [isSaving, setIsSaving] = useState(false);
  
  // Branding States
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#10b981');
  const [accentColor, setAccentColor] = useState('#f43f5e');
  const [buttonRadius, setButtonRadius] = useState('8px');
  
  // Legal States
  const [erisaText, setErisaText] = useState('In accordance with the Employee Retirement Income Security Act of 1974 (ERISA)...');
  const [consentText, setConsentText] = useState('By checking this box, I legally consent to doing business electronically with SabSign Corporation...');
  
  // Security States
  const [ipWhitelist, setIpWhitelist] = useState(initialIpWhitelist);
  const [newIp, setNewIp] = useState('');
  
  // Save Handler
  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  const TabIcon = tabs.find(t => t.id === activeTab)?.icon || Settings;

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-300 font-sans p-6 md:p-10">
      
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-indigo-500" />
              SabSign Configurations
            </h1>
            <p className="text-gray-400 mt-1">Manage corporate branding, legal disclosures, security policies, and system settings.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Reset Defaults
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-3 sticky top-6">
            <nav className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                      isActive 
                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' 
                        : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isActive ? 'text-indigo-400' : 'text-gray-500'}`} />
                    <div>
                      <div className={`font-medium ${isActive ? 'text-indigo-300' : 'text-gray-300'}`}>{tab.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{tab.description}</div>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Compliance Status</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">SOC2 Type II</span>
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Active</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">HIPAA BAA</span>
                  <span className="text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Pending</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6">
          <div className="bg-[#121214] border border-gray-800/60 rounded-xl p-6 shadow-xl shadow-black/20">
            
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-800/60">
              <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center">
                <TabIcon className="w-5 h-5 text-gray-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{tabs.find(t => t.id === activeTab)?.name}</h2>
                <p className="text-sm text-gray-500">Configure settings specifically tailored for this module.</p>
              </div>
            </div>

            {/* TAB: GENERAL SETTINGS */}
            {activeTab === 'general' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Organization Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Company Legal Name</label>
                      <input type="text" defaultValue="SabDesk Corporation" className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Primary Contact Email</label>
                      <input type="email" defaultValue="legal@sabdesk.com" className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Support Phone Number</label>
                      <input type="text" defaultValue="+1 (800) 555-0199" className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Headquarters Address</label>
                      <input type="text" defaultValue="123 Signature Way, Suite 400, San Francisco, CA 94105" className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
                    </div>
                  </div>
                </section>

                <div className="h-px bg-gray-800/60 w-full" />

                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Localization & Formatting</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Default Timezone</label>
                      <select className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none">
                        <option>(UTC-08:00) Pacific Time (US & Canada)</option>
                        <option>(UTC-05:00) Eastern Time (US & Canada)</option>
                        <option>(UTC+00:00) Greenwich Mean Time</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Date Format</label>
                      <select className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none">
                        <option>MM/DD/YYYY</option>
                        <option>DD/MM/YYYY</option>
                        <option>YYYY-MM-DD</option>
                      </select>
                    </div>
                  </div>
                </section>
                
                <div className="h-px bg-gray-800/60 w-full" />

                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Feature Toggles</h3>
                  <div className="space-y-4">
                    {[
                      { title: 'Auto-Reminders', desc: 'Automatically send email reminders to signers who haven\'t viewed documents.' },
                      { title: 'SMS Authentication', desc: 'Require recipients to enter a code sent via SMS before viewing.' },
                      { title: 'Audit Trail Append', desc: 'Automatically append the PDF audit trail to the final signed document.' },
                      { title: 'Block Disposable Emails', desc: 'Prevent envelopes from being sent to known disposable email providers.' }
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-[#0a0a0b] border border-gray-800/80">
                        <div>
                          <div className="font-medium text-gray-200">{feature.title}</div>
                          <div className="text-sm text-gray-500">{feature.desc}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked={i % 2 === 0} />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </section>

              </div>
            )}

            {/* TAB: CORPORATE BRANDING */}
            {activeTab === 'branding' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Logo Upload Section */}
                <section>
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-indigo-400" />
                    Company Logo Assets
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#0a0a0b] hover:bg-gray-900/50 transition-colors cursor-pointer group">
                      <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-indigo-400" />
                      </div>
                      <p className="text-gray-300 font-medium mb-1">Upload Primary Logo</p>
                      <p className="text-sm text-gray-500">SVG, PNG, or JPG. Max 5MB.</p>
                      <p className="text-xs text-gray-600 mt-2">Recommended size: 400x120px</p>
                    </div>
                    <div className="border border-gray-700 rounded-xl p-6 bg-[#0a0a0b] flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Current Logo</h4>
                        <div className="bg-white/5 rounded-lg p-6 flex items-center justify-center h-32 border border-gray-800">
                          {/* Mock Logo */}
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center rotate-3 shadow-lg shadow-indigo-500/20">
                              <Zap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight">Sab<span className="text-indigo-400">Desk</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end mt-4">
                        <button className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                          <Trash2 className="w-4 h-4" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-gray-800/60 w-full" />

                {/* Color Scheme */}
                <section>
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-indigo-400" />
                    Color Palette
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Primary Color Picker */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-400 block">Primary Brand Color</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg shadow-inner border border-gray-600 cursor-pointer" style={{ backgroundColor: primaryColor }}></div>
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={primaryColor} 
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 font-mono text-sm focus:outline-none focus:border-indigo-500 transition-all uppercase"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Used for primary buttons, highlights, and active states.</p>
                    </div>

                    {/* Secondary Color Picker */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-400 block">Secondary Color</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg shadow-inner border border-gray-600 cursor-pointer" style={{ backgroundColor: secondaryColor }}></div>
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={secondaryColor} 
                            onChange={(e) => setSecondaryColor(e.target.value)}
                            className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 font-mono text-sm focus:outline-none focus:border-indigo-500 transition-all uppercase"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Used for success states, secondary buttons, and gradients.</p>
                    </div>

                    {/* Accent Color Picker */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-400 block">Accent / Alert Color</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg shadow-inner border border-gray-600 cursor-pointer" style={{ backgroundColor: accentColor }}></div>
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={accentColor} 
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-3 py-2.5 text-gray-200 font-mono text-sm focus:outline-none focus:border-indigo-500 transition-all uppercase"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Used for warnings, errors, and notifications.</p>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-gray-800/60 w-full" />

                {/* Typography & Styling */}
                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Typography & UI Elements</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Heading Font Family</label>
                      <select className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none">
                        <option>Inter (Default)</option>
                        <option>Roboto</option>
                        <option>Poppins</option>
                        <option>Open Sans</option>
                        <option>Custom Web Font...</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Button & Card Border Radius</label>
                      <div className="flex items-center gap-4 bg-[#0a0a0b] border border-gray-700 rounded-lg px-4 py-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="24" 
                          value={parseInt(buttonRadius)} 
                          onChange={(e) => setButtonRadius(`${e.target.value}px`)}
                          className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                        />
                        <span className="text-sm font-mono text-gray-300 w-10 text-right">{buttonRadius}</span>
                      </div>
                    </div>
                  </div>
                </section>
                
                {/* Live Preview Pane */}
                <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">Live Preview</div>
                  <h4 className="text-sm font-medium text-gray-400 mb-6">Component Preview</h4>
                  
                  <div className="flex flex-col md:flex-row gap-8 items-center justify-center bg-[#0a0a0b] p-8 rounded-lg border border-gray-800 shadow-inner">
                    <button 
                      className="px-6 py-3 text-white font-medium shadow-lg transition-transform hover:-translate-y-1"
                      style={{ backgroundColor: primaryColor, borderRadius: buttonRadius, boxShadow: `0 4px 14px 0 ${primaryColor}40` }}
                    >
                      Primary Action
                    </button>
                    
                    <button 
                      className="px-6 py-3 font-medium transition-transform hover:-translate-y-1 border-2"
                      style={{ borderColor: secondaryColor, color: secondaryColor, borderRadius: buttonRadius }}
                    >
                      Secondary Action
                    </button>
                    
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 rounded-lg" style={{ color: accentColor, borderRadius: buttonRadius }}>
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Destructive Action</span>
                    </div>
                  </div>
                </section>

              </div>
            )}

            {/* TAB: LEGAL & DISCLOSURES */}
            {activeTab === 'legal' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-amber-500 font-medium">Legal Review Recommended</h4>
                    <p className="text-sm text-amber-500/80 mt-1">Changes to electronic signature consent or ERISA disclosures may have legal implications. Please consult with your legal department before publishing changes.</p>
                  </div>
                </div>

                {/* Rich Text Editor Mock - Electronic Consent */}
                <section className="space-y-3">
                  <div className="flex justify-between items-end">
                    <div>
                      <h3 className="text-lg font-medium text-white">Electronic Signature Consent (ESIGN Act)</h3>
                      <p className="text-sm text-gray-500 mt-1">This text is displayed to signers before they can view documents.</p>
                    </div>
                  </div>
                  
                  <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0a0a0b]">
                    <div className="bg-[#121214] border-b border-gray-700 p-2 flex items-center gap-1 flex-wrap">
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><Bold className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><Italic className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><Underline className="w-4 h-4" /></button>
                      <div className="w-px h-4 bg-gray-700 mx-1"></div>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><AlignLeft className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><AlignCenter className="w-4 h-4" /></button>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"><AlignRight className="w-4 h-4" /></button>
                      <div className="w-px h-4 bg-gray-700 mx-1"></div>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors text-sm font-medium">H1</button>
                      <button className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors text-sm font-medium">H2</button>
                    </div>
                    <textarea 
                      value={consentText}
                      onChange={(e) => setConsentText(e.target.value)}
                      className="w-full h-40 bg-transparent p-4 text-gray-300 focus:outline-none resize-y"
                    ></textarea>
                    <div className="bg-[#121214] border-t border-gray-700 p-2 text-xs text-gray-500 text-right">
                      {consentText.length} characters
                    </div>
                  </div>
                </section>

                <div className="h-px bg-gray-800/60 w-full" />

                {/* ERISA Disclosures */}
                <section className="space-y-3">
                  <div>
                    <h3 className="text-lg font-medium text-white">ERISA & 401(k) Disclosures</h3>
                    <p className="text-sm text-gray-500 mt-1">Specific compliance text required for HR and Benefits envelopes.</p>
                  </div>
                  
                  <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0a0a0b]">
                    <textarea 
                      value={erisaText}
                      onChange={(e) => setErisaText(e.target.value)}
                      className="w-full h-32 bg-transparent p-4 text-gray-300 focus:outline-none resize-y"
                    ></textarea>
                  </div>
                </section>

                <div className="h-px bg-gray-800/60 w-full" />

                {/* Privacy Policy & TOS Links */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Terms of Service URL</label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                      <input type="url" defaultValue="https://sabdesk.com/terms" className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Privacy Policy URL</label>
                    <div className="relative">
                      <Shield className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                      <input type="url" defaultValue="https://sabdesk.com/privacy" className="w-full bg-[#0a0a0b] border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>
                  </div>
                </section>

              </div>
            )}

            {/* TAB: SECURITY & COMPLIANCE */}
            {activeTab === 'security' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* Auth Policies */}
                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Authentication Policies</h3>
                  
                  <div className="bg-[#0a0a0b] border border-gray-800 rounded-lg p-5 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-200">Require Two-Factor Authentication (2FA)</div>
                        <div className="text-sm text-gray-500">Enforce 2FA for all administrative accounts accessing SabSign settings.</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>

                    <div className="h-px bg-gray-800 w-full" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Idle Session Timeout (Minutes)</label>
                        <select className="w-full bg-[#121214] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 appearance-none">
                          <option>15 Minutes</option>
                          <option>30 Minutes</option>
                          <option>60 Minutes</option>
                          <option>120 Minutes</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Password Expiration (Days)</label>
                        <select className="w-full bg-[#121214] border border-gray-700 rounded-lg px-4 py-2.5 text-gray-200 focus:outline-none focus:border-indigo-500 appearance-none">
                          <option>30 Days</option>
                          <option>60 Days</option>
                          <option>90 Days</option>
                          <option>Never (Not Recommended)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </section>

                {/* IP Whitelisting */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Network className="w-5 h-5 text-indigo-400" />
                      IP Address Whitelist
                    </h3>
                    <button className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors">
                      <Plus className="w-4 h-4" /> Add IP Address
                    </button>
                  </div>
                  
                  <div className="border border-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm text-gray-400">
                      <thead className="bg-[#0a0a0b] text-gray-300 border-b border-gray-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">IP Address / CIDR</th>
                          <th className="px-4 py-3 font-medium">Label</th>
                          <th className="px-4 py-3 font-medium">Added By</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60 bg-[#121214]">
                        {ipWhitelist.map(ip => (
                          <tr key={ip.id} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-gray-300">{ip.ip}</td>
                            <td className="px-4 py-3">{ip.label}</td>
                            <td className="px-4 py-3 text-xs">{ip.addedBy}</td>
                            <td className="px-4 py-3 text-right">
                              <button className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-gray-800">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Audit Logs */}
                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Audit Log Retention</h3>
                  <div className="bg-[#0a0a0b] border border-gray-800 rounded-lg p-5">
                    <p className="text-sm text-gray-400 mb-4">Select how long detailed security and access audit logs should be retained in the system before being archived to cold storage.</p>
                    <div className="flex items-center gap-4">
                      <input type="range" min="30" max="365" defaultValue="90" className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                      <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-200 font-mono text-sm w-24 text-center">
                        90 Days
                      </div>
                    </div>
                  </div>
                </section>

              </div>
            )}

            {/* TAB: ADVANCED CONFIGURATIONS */}
            {activeTab === 'advanced' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                {/* API Keys */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-white flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-400" />
                        API Keys
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">Manage API keys for programmatic access to SabSign.</p>
                    </div>
                    <button className="px-4 py-2 bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600/20 rounded-lg text-sm font-medium transition-colors">
                      Generate New Key
                    </button>
                  </div>
                  
                  <div className="bg-[#0a0a0b] border border-gray-800 rounded-lg p-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-800">
                      <div>
                        <div className="font-medium text-gray-200">Production Integration Key</div>
                        <div className="text-xs text-gray-500 mt-1">Created on Jan 12, 2026 • Last used 5 mins ago</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-[#121214] border border-gray-700 px-3 py-1.5 rounded font-mono text-xs text-gray-400 flex items-center gap-2">
                          sk_prod_••••••••••••••••••••8f2a
                          <Eye className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                        </div>
                        <button className="text-red-400 hover:text-red-300 text-sm px-2">Revoke</button>
                      </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4">
                      <div>
                        <div className="font-medium text-gray-200">Staging Environment</div>
                        <div className="text-xs text-gray-500 mt-1">Created on Feb 22, 2026 • Never used</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="bg-[#121214] border border-gray-700 px-3 py-1.5 rounded font-mono text-xs text-gray-400 flex items-center gap-2">
                          sk_test_••••••••••••••••••••3b9c
                          <Eye className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                        </div>
                        <button className="text-red-400 hover:text-red-300 text-sm px-2">Revoke</button>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Webhooks */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      Webhook Endpoints
                    </h3>
                    <button className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors">
                      <Plus className="w-4 h-4" /> Add Endpoint
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {mockWebhooks.map(hook => (
                      <div key={hook.id} className="bg-[#0a0a0b] border border-gray-800 rounded-lg p-4 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${hook.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            <span className="font-mono text-sm text-gray-300 break-all">{hook.url}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {hook.events.map(ev => (
                              <span key={ev} className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs border border-gray-700">{ev}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between w-full lg:w-auto gap-2">
                          <div className="text-xs text-gray-500">Last fired: {hook.lastFired}</div>
                          <div className="flex gap-3 text-sm">
                            <button className="text-gray-400 hover:text-white">Edit</button>
                            <button className="text-gray-400 hover:text-white">Test</button>
                            <button className="text-red-400 hover:text-red-300">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SSO Configuration */}
                <section>
                  <h3 className="text-lg font-medium text-white mb-4">Single Sign-On (SSO)</h3>
                  <div className="border border-gray-800 rounded-lg bg-[#0a0a0b] overflow-hidden">
                    <div className="p-5 border-b border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-200">SAML 2.0 Integration</div>
                          <div className="text-sm text-gray-500 mt-1">Allow users to log in using Okta, Azure AD, or other SAML providers.</div>
                        </div>
                        <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                          Configure
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-200">OAuth / Social Login</div>
                          <div className="text-sm text-gray-500 mt-1">Enable login via Google Workspace or Microsoft 365.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Dummy icon to fulfill missing import mock
function Network(props: any) {
  return <Server {...props} />
}
