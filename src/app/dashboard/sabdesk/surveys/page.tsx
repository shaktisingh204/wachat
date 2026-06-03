"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, PieChart, LineChart, Activity, Users, Star, ThumbsUp, 
  MessageSquare, Plus, Settings, Search, Filter, Download, MoreVertical,
  CheckCircle, XCircle, Clock, LayoutGrid, Type, AlignLeft, Hash, 
  CheckSquare, CircleDot, Calendar, Image as ImageIcon, Link2,
  ChevronDown, ChevronRight, GripVertical, Trash2, Edit3, Copy,
  Eye, Save, Send, Share2, Mail, Globe, Smartphone, Monitor,
  AlertCircle, ArrowUpRight, ArrowDownRight, Briefcase, Zap, Bell, Target
} from 'lucide-react';

// --- MOCK DATA ---

const METRICS_DATA = {
  nps: { value: 72, trend: '+5', previous: 67 },
  csat: { value: 94, trend: '+2', previous: 92 },
  responses: { value: 12450, trend: '+12%', previous: 11116 },
  completionRate: { value: 88, trend: '-1%', previous: 89 },
};

const RECENT_RESPONSES = Array.from({ length: 50 }).map((_, i) => ({
  id: `RESP-${1000 + i}`,
  user: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  score: Math.floor(Math.random() * 10) + 1,
  feedback: ['Great service!', 'Could be better.', 'Loved the new features.', 'Support was helpful.', 'Too expensive.'][Math.floor(Math.random() * 5)],
  date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0],
  status: Math.random() > 0.8 ? 'Pending' : 'Reviewed',
  sentiment: Math.random() > 0.5 ? 'Positive' : Math.random() > 0.5 ? 'Neutral' : 'Negative',
  segment: ['Enterprise', 'SMB', 'Startup', 'Individual'][Math.floor(Math.random() * 4)]
}));

const SURVEY_TEMPLATES = [
  { id: 't1', name: 'Customer Satisfaction (CSAT)', uses: 1240, rating: 4.8 },
  { id: 't2', name: 'Net Promoter Score (NPS)', uses: 3500, rating: 4.9 },
  { id: 't3', name: 'Product Feedback', uses: 890, rating: 4.5 },
  { id: 't4', name: 'Employee Engagement', uses: 450, rating: 4.7 },
  { id: 't5', name: 'Onboarding Experience', uses: 670, rating: 4.6 },
];

const FORM_ELEMENTS = [
  { type: 'short_text', label: 'Short Text', icon: Type },
  { type: 'long_text', label: 'Long Text', icon: AlignLeft },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'nps', label: 'NPS Scale', icon: Activity },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: CircleDot },
  { type: 'checkboxes', label: 'Checkboxes', icon: CheckSquare },
  { type: 'dropdown', label: 'Dropdown', icon: ChevronDown },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'image', label: 'Image Upload', icon: ImageIcon },
];

// --- COMPONENTS ---

const MetricCard = ({ title, value, trend, isPositive, icon: Icon, subtitle }) => (
  <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden group">
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="flex justify-between items-start mb-4 z-10">
      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">
        <Icon className="w-6 h-6 text-indigo-400" />
      </div>
      <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        <span>{trend}</span>
      </div>
    </div>
    <div className="z-10">
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <div className="flex items-baseline space-x-2">
        <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
        {subtitle && <span className="text-slate-500 text-sm">{subtitle}</span>}
      </div>
    </div>
  </div>
);

const ChartMockup = ({ title, type = 'bar' }) => (
  <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 flex flex-col h-80">
    <div className="flex justify-between items-center mb-6">
      <h3 className="text-white font-semibold">{title}</h3>
      <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
        <MoreVertical className="w-5 h-5" />
      </button>
    </div>
    <div className="flex-1 flex items-end justify-between space-x-2 pb-4">
      {/* Mocking a bar chart with divs */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="w-full flex flex-col justify-end items-center group">
          <div className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 mb-2 transition-opacity">
            {Math.floor(Math.random() * 100) + 20}
          </div>
          <div 
            className="w-full bg-gradient-to-t from-indigo-600/80 to-purple-500/80 rounded-t-sm transition-all duration-500 group-hover:from-indigo-500 group-hover:to-purple-400 relative overflow-hidden"
            style={{ height: `${Math.floor(Math.random() * 80) + 10}%` }}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </div>
          <div className="mt-2 text-[10px] text-slate-500 font-medium uppercase">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i]}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- MAIN PAGE COMPONENT ---

export default function SurveysFeedbackPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form Builder State
  const [formFields, setFormFields] = useState([
    { id: 'f1', type: 'nps', label: 'How likely are you to recommend us?', required: true },
    { id: 'f2', type: 'long_text', label: 'What could we do better?', required: false }
  ]);
  const [selectedField, setSelectedField] = useState(null);

  // Response Grid State
  const [selectedResponses, setSelectedResponses] = useState([]);
  const [responseFilter, setResponseFilter] = useState('all');

  const addFormField = (type) => {
    const newField = {
      id: `f${Date.now()}`,
      type,
      label: `New ${type.replace('_', ' ')} field`,
      required: false
    };
    setFormFields([...formFields, newField]);
    setSelectedField(newField.id);
  };

  const removeFormField = (id) => {
    setFormFields(formFields.filter(f => f.id !== id));
    if (selectedField === id) setSelectedField(null);
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Net Promoter Score" value={METRICS_DATA.nps.value} trend={METRICS_DATA.nps.trend} isPositive={true} icon={Activity} />
        <MetricCard title="Customer Satisfaction" value={`${METRICS_DATA.csat.value}%`} trend={METRICS_DATA.csat.trend} isPositive={true} icon={Star} />
        <MetricCard title="Total Responses" value={METRICS_DATA.responses.value.toLocaleString()} trend={METRICS_DATA.responses.trend} isPositive={true} icon={MessageSquare} />
        <MetricCard title="Completion Rate" value={`${METRICS_DATA.completionRate.value}%`} trend={METRICS_DATA.completionRate.trend} isPositive={false} icon={CheckCircle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartMockup title="Response Volume & Sentiment Over Time" />
        </div>
        
        {/* Recent Activity Feed */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 h-80 flex flex-col">
          <h3 className="text-white font-semibold mb-6 flex items-center"><Clock className="w-5 h-5 mr-2 text-indigo-400" /> Recent Activity</h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {RECENT_RESPONSES.slice(0, 8).map((resp, i) => (
              <div key={i} className="flex items-start space-x-3 pb-3 border-b border-slate-800/50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700 text-xs font-bold text-slate-300">
                  {resp.user.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-slate-300"><span className="font-medium text-white">{resp.user}</span> submitted feedback</p>
                  <p className="text-xs text-slate-500 mt-1 flex items-center">
                    <Star className="w-3 h-3 text-yellow-500 mr-1 fill-yellow-500" />
                    {resp.score}/10 • {resp.sentiment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommended Templates */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Recommended Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {SURVEY_TEMPLATES.map(template => (
            <div key={template.id} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 hover:bg-slate-800/60 transition-all cursor-pointer group hover:border-indigo-500/50">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <FileTemplateIcon />
              </div>
              <h4 className="text-slate-200 font-medium text-sm mb-2">{template.name}</h4>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{template.uses.toLocaleString()} uses</span>
                <span className="flex items-center"><Star className="w-3 h-3 mr-1 text-yellow-500" /> {template.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFormBuilder = () => (
    <div className="flex h-[calc(100vh-140px)] gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Sidebar Elements */}
      <div className="w-72 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl shadow-black/50">
        <div className="p-4 border-b border-slate-800 bg-slate-900/90">
          <h3 className="font-semibold text-white flex items-center"><LayoutGrid className="w-5 h-5 mr-2 text-indigo-400" /> Elements</h3>
        </div>
        <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-3 custom-scrollbar">
          {FORM_ELEMENTS.map((el, idx) => (
            <button
              key={idx}
              onClick={() => addFormField(el.type)}
              className="flex flex-col items-center justify-center p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all group"
            >
              <el.icon className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 mb-2 transition-colors" />
              <span className="text-xs text-slate-300 text-center font-medium">{el.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-slate-900/30 border border-slate-800/50 rounded-2xl overflow-y-auto p-8 custom-scrollbar relative shadow-inner">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-slate-900 border-t-4 border-indigo-500 border-x border-b border-slate-800 rounded-xl p-8 shadow-xl">
            <input 
              type="text" 
              defaultValue="Customer Satisfaction Survey 2026"
              className="text-3xl font-bold bg-transparent border-none text-white w-full focus:ring-0 focus:outline-none mb-2 placeholder-slate-600"
            />
            <input 
              type="text" 
              defaultValue="Please help us improve our services by providing your honest feedback."
              className="text-slate-400 bg-transparent border-none w-full focus:ring-0 focus:outline-none text-sm placeholder-slate-700"
            />
          </div>

          {formFields.map((field, idx) => (
            <div 
              key={field.id}
              onClick={() => setSelectedField(field.id)}
              className={`bg-slate-900 border rounded-xl p-6 transition-all cursor-pointer relative group ${selectedField === field.id ? 'border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]' : 'border-slate-800 hover:border-slate-600'}`}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-slate-800 rounded-full border border-slate-700 shadow-lg cursor-grab">
                <GripVertical className="w-4 h-4 text-slate-400" />
              </div>
              
              {selectedField === field.id && (
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"><Copy className="w-4 h-4" /></button>
                  <button onClick={(e) => { e.stopPropagation(); removeFormField(field.id); }} className="p-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-slate-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}

              <input 
                type="text"
                value={field.label}
                onChange={(e) => {
                  const newFields = [...formFields];
                  newFields[idx].label = e.target.value;
                  setFormFields(newFields);
                }}
                className={`text-lg font-medium bg-transparent border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none w-3/4 pb-1 mb-4 text-white ${selectedField === field.id ? 'border-slate-700' : ''}`}
              />

              <div className="opacity-70 pointer-events-none">
                {field.type === 'short_text' && <div className="border-b border-slate-700 pb-2 text-slate-500 w-1/2">Short answer text</div>}
                {field.type === 'long_text' && <div className="border-b border-slate-700 pb-8 text-slate-500 w-3/4">Long answer text</div>}
                {field.type === 'nps' && (
                  <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg">
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                      <div key={n} className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-700 text-slate-400 font-medium">{n}</div>
                    ))}
                  </div>
                )}
                {/* Add more mock previews based on type */}
                {['multiple_choice', 'checkboxes'].includes(field.type) && (
                  <div className="space-y-3">
                    <div className="flex items-center text-slate-500"><CircleDot className="w-4 h-4 mr-2" /> Option 1</div>
                    <div className="flex items-center text-slate-500"><CircleDot className="w-4 h-4 mr-2" /> Option 2</div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <button onClick={() => addFormField('short_text')} className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex items-center justify-center font-medium">
            <Plus className="w-5 h-5 mr-2" /> Add Question
          </button>
        </div>
      </div>

      {/* Properties Panel */}
      {selectedField && (
        <div className="w-80 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl flex flex-col shadow-2xl shadow-black/50 animate-in slide-in-from-right-8 fade-in">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/90">
            <h3 className="font-semibold text-white flex items-center"><Settings className="w-5 h-5 mr-2 text-indigo-400" /> Properties</h3>
            <button onClick={() => setSelectedField(null)} className="text-slate-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Question Type</label>
              <select className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                {FORM_ELEMENTS.map(el => <option key={el.type} value={el.type}>{el.label}</option>)}
              </select>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Required Field</span>
                <div className="relative inline-flex items-center">
                  <input type="checkbox" className="sr-only peer" defaultChecked={formFields.find(f => f.id === selectedField)?.required} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </div>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-4">
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Description (Optional)</label>
              <textarea 
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] resize-none"
                placeholder="Add helpful text..."
              />
            </div>
            
            {/* Logic Jumps mock */}
            <div className="pt-4 border-t border-slate-800">
              <button className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white font-medium flex items-center justify-center transition-colors border border-slate-700">
                <Zap className="w-4 h-4 mr-2 text-amber-400" /> Configure Logic Jumps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderResponses = () => (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 justify-between items-center bg-slate-900/80">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search responses..." 
              className="bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-indigo-500 w-64 transition-colors"
            />
          </div>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            {['all', 'positive', 'negative'].map(f => (
              <button 
                key={f}
                onClick={() => setResponseFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${responseFilter === f ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium border border-slate-700 transition-colors">
            <Filter className="w-4 h-4 mr-2" /> Filter
          </button>
          <button className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 transition-colors">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </button>
        </div>
      </div>

      {/* Data Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900/90 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-800">
            <tr>
              <th className="p-4 w-12"><input type="checkbox" className="rounded bg-slate-800 border-slate-700" /></th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Feedback</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sentiment</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Segment</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {RECENT_RESPONSES.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="p-4"><input type="checkbox" className="rounded bg-slate-800 border-slate-700" /></td>
                <td className="p-4 text-sm font-medium text-slate-400">{row.id}</td>
                <td className="p-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs mr-3">
                      {row.user.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{row.user}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                    row.score >= 9 ? 'bg-emerald-500/10 text-emerald-400' :
                    row.score >= 7 ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-rose-500/10 text-rose-400'
                  }`}>
                    {row.score}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-300 max-w-xs truncate" title={row.feedback}>
                  {row.feedback}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border ${
                    row.sentiment === 'Positive' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
                    row.sentiment === 'Neutral' ? 'bg-slate-500/5 border-slate-500/20 text-slate-400' :
                    'bg-rose-500/5 border-rose-500/20 text-rose-400'
                  }`}>
                    {row.sentiment}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-400">{row.segment}</td>
                <td className="p-4 text-sm text-slate-400">{row.date}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-md text-slate-400 transition-colors"><Eye className="w-4 h-4" /></button>
                    <button className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 transition-colors"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-sm text-slate-400">
        <span>Showing 1 to 50 of {METRICS_DATA.responses.value} entries</span>
        <div className="flex space-x-2">
          <button className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50">Prev</button>
          <button className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700">Next</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans flex flex-col selection:bg-indigo-500/30">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Target className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">SabDesk Surveys</h1>
          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded text-[10px] text-indigo-400 font-medium uppercase tracking-wider">Enterprise</span>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border-2 border-slate-800 overflow-hidden cursor-pointer">
            <img src="https://i.pravatar.cc/150?img=11" alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Navigation Sidebar */}
        <aside className={`bg-slate-900/40 border-r border-slate-800/80 backdrop-blur-sm flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
          <div className="p-4 flex-1 space-y-2">
            {[
              { id: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
              { id: 'builder', icon: Edit3, label: 'Form Builder' },
              { id: 'responses', icon: MessageSquare, label: 'Responses & Data' },
              { id: 'analytics', icon: PieChart, label: 'Analytics' },
              { id: 'distribution', icon: Send, label: 'Distribution' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map(nav => (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
                className={`w-full flex items-center p-3 rounded-xl transition-all group ${
                  activeTab === nav.id 
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]' 
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                }`}
                title={!sidebarOpen ? nav.label : ''}
              >
                <nav.icon className={`w-5 h-5 ${sidebarOpen ? 'mr-3' : 'mx-auto'} ${activeTab === nav.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {sidebarOpen && <span className="font-medium text-sm">{nav.label}</span>}
              </button>
            ))}
          </div>
          
          <div className="p-4 border-t border-slate-800/50">
             <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center justify-center p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} />
             </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden flex flex-col relative bg-gradient-to-br from-slate-900 via-[#0B0F19] to-[#0A0D14]">
          {/* Decorative background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-6 md:p-8 z-10 custom-scrollbar">
            
            {/* Contextual Header based on active tab */}
            <div className="mb-8 flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight capitalize">{activeTab.replace('_', ' ')}</h2>
                <p className="text-slate-400 mt-1">
                  {activeTab === 'dashboard' && 'Overview of your survey performance and recent activity.'}
                  {activeTab === 'builder' && 'Design and customize your survey forms visually.'}
                  {activeTab === 'responses' && 'Analyze and manage individual survey submissions.'}
                </p>
              </div>
              
              {activeTab === 'builder' && (
                <div className="flex space-x-3">
                  <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700 flex items-center transition-colors shadow-sm">
                    <Eye className="w-4 h-4 mr-2" /> Preview
                  </button>
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium flex items-center transition-colors shadow-lg shadow-indigo-500/25">
                    <Save className="w-4 h-4 mr-2" /> Save Form
                  </button>
                </div>
              )}
            </div>

            {/* Content Renderers */}
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'builder' && renderFormBuilder()}
            {activeTab === 'responses' && renderResponses()}
            
            {/* Placeholders for other tabs to show complexity */}
            {['analytics', 'distribution', 'settings'].includes(activeTab) && (
              <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                <Settings className="w-16 h-16 text-slate-700 mb-4 animate-spin-slow" />
                <h3 className="text-xl font-semibold text-slate-400 mb-2">Module Under Construction</h3>
                <p className="text-slate-500 text-sm max-w-md text-center">This specialized massive view is being rendered by other Micro-frontends in the SabDesk architecture.</p>
              </div>
            )}
            
          </div>
        </main>
      </div>

      {/* Global Styles for Custom Scrollbar & Animations inside component scope for ease */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
      `}} />
    </div>
  );
}

function FileTemplateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
