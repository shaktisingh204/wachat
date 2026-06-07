"use client";

import { useState, useEffect } from "react";
import {
  Avatar,
  AvatarFallback,
  Button,
  IconButton,
  Field,
  Input,
  ScrollArea,
  Badge,
  EmptyState,
} from "@/components/sabcrm/20ui";
import {
  MessageSquare,
  X,
  Send,
  PhoneCall,
  Video,
  MonitorUp,
  Search,
  HelpCircle,
  ChevronLeft,
  Loader2,
  Mic,
  VideoOff,
  MousePointer2,
  FileQuestion,
} from "lucide-react";

type ViewState = 'pre-chat' | 'chat' | 'help' | 'voice-call' | 'video-call' | 'co-browse';

export default function SabChatWidgetPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ViewState>('pre-chat');
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Pre-chat form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Chat state
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How can we help you today?", sender: 'agent', time: '10:00 AM' }
  ]);
  const [newMessage, setNewMessage] = useState("");

  // Help center state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCalling) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    setView('chat');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setMessages(prev => [
      ...prev,
      { id: Date.now(), text: newMessage, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
    setNewMessage("");

    // Simulate agent reply
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { id: Date.now(), text: "Thanks for reaching out! We are connecting you to an agent.", sender: 'agent', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }, 1000);
  };

  const handleStartCall = (type: 'voice-call' | 'video-call' | 'co-browse') => {
    setView(type);
    setIsCalling(true);
    setCallDuration(0);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setView('chat');
    setCallDuration(0);
  };

  const helpArticles = [
    { title: "How to setup your account", category: "Getting Started" },
    { title: "Billing and Invoicing FAQs", category: "Billing" },
    { title: "Integrating with WhatsApp", category: "Integrations" },
    { title: "Managing team permissions", category: "Admin" },
  ];
  const filteredArticles = helpArticles.filter(a =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] flex flex-col items-end justify-end p-4 sm:p-6 font-sans">
      {/* Widget Container */}
      <div
        className={`pointer-events-auto flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ease-in-out transform origin-bottom-right rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)]
          ${isOpen ? 'scale-100 opacity-100 mb-4 h-[600px] w-full max-w-[400px]' : 'scale-0 opacity-0 h-0 w-0'}`}
      >
        {/* Header */}
        <div className="bg-[var(--st-accent)] flex items-center justify-between px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            {view !== 'pre-chat' && view !== 'chat' ? (
              <IconButton
                label="Back to chat"
                icon={ChevronLeft}
                onClick={() => setView('chat')}
                className="text-white hover:bg-white/20"
              />
            ) : null}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Avatar className="h-8 w-8 border border-white/20">
                  <AvatarFallback className="bg-white/10 text-white">S</AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--st-accent)] bg-[var(--st-text)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-none">SabChat Support</h3>
                <p className="text-xs text-white/80 mt-0.5">We typically reply instantly</p>
              </div>
            </div>
          </div>
          <IconButton
            label="Close widget"
            icon={X}
            onClick={() => setIsOpen(false)}
            className="text-white hover:bg-white/20"
          />
        </div>

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[var(--st-bg-muted)]">

          {/* 1. PRE-CHAT FORM */}
          {view === 'pre-chat' && (
            <div className="flex-1 overflow-y-auto p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-6 space-y-2">
                <h4 className="font-semibold text-[var(--st-text)] text-lg">Welcome to SabChat!</h4>
                <p className="text-sm text-[var(--st-text-secondary)]">Please introduce yourself before we start the conversation.</p>
              </div>
              <form onSubmit={handleStartChat} className="space-y-4">
                <Field label="Full Name">
                  <Input
                    placeholder="John Doe"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-[var(--st-bg-secondary)]"
                  />
                </Field>
                <Field label="Email Address">
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[var(--st-bg-secondary)]"
                  />
                </Field>
                <Button type="submit" variant="primary" block className="mt-2">Start Conversation</Button>
              </form>

              <div className="mt-8 border-t border-[var(--st-border)] pt-6">
                <p className="text-xs text-center text-[var(--st-text-secondary)] mb-4">Or try looking for an answer yourself</p>
                <Button variant="outline" block iconLeft={Search} onClick={() => setView('help')}>
                  Search Help Center
                </Button>
              </div>
            </div>
          )}

          {/* 2. CHAT INTERFACE */}
          {view === 'chat' && (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-left-2 duration-300">
              {/* Action Bar */}
              <div className="flex items-center justify-around border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] py-2 px-1">
                <Button variant="ghost" size="sm" onClick={() => handleStartCall('voice-call')} className="text-xs flex-col h-auto py-2 gap-1 text-[var(--st-text-secondary)] hover:text-[var(--st-accent)]">
                  <PhoneCall className="w-4 h-4" aria-hidden="true" />
                  Voice
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleStartCall('video-call')} className="text-xs flex-col h-auto py-2 gap-1 text-[var(--st-text-secondary)] hover:text-[var(--st-accent)]">
                  <Video className="w-4 h-4" aria-hidden="true" />
                  Video
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleStartCall('co-browse')} className="text-xs flex-col h-auto py-2 gap-1 text-[var(--st-text-secondary)] hover:text-[var(--st-accent)]">
                  <MonitorUp className="w-4 h-4" aria-hidden="true" />
                  Co-browse
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setView('help')} className="text-xs flex-col h-auto py-2 gap-1 text-[var(--st-text-secondary)] hover:text-[var(--st-accent)]">
                  <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  Help
                </Button>
              </div>

              {/* Messages Area */}
              <ScrollArea className="flex-1 p-4 flex flex-col gap-4">
                <div className="space-y-4">
                  <div className="text-center text-xs text-[var(--st-text-secondary)] my-2">Today</div>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm
                        ${msg.sender === 'user'
                          ? 'bg-[var(--st-accent)] text-white rounded-tr-sm'
                          : 'bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)] rounded-tl-sm'}`}
                      >
                        {msg.text}
                        <div className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-white/70' : 'text-[var(--st-text-secondary)]'}`}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-3 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    aria-label="Type a message"
                    className="pr-10 rounded-full bg-[var(--st-bg-muted)] border-[var(--st-border)]"
                  />
                  <IconButton
                    label="Send message"
                    icon={Send}
                    type="submit"
                    variant="primary"
                    disabled={!newMessage.trim()}
                    className="absolute right-1 top-1 bottom-1 h-8 w-8 rounded-full"
                  />
                </form>
              </div>
            </div>
          )}

          {/* 3. HELP CENTER */}
          {view === 'help' && (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <Input
                  iconLeft={Search}
                  placeholder="Search articles..."
                  aria-label="Search help articles"
                  className="bg-[var(--st-bg-muted)]"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearching(true);
                    setTimeout(() => setIsSearching(false), 500);
                  }}
                />
              </div>
              <ScrollArea className="flex-1 p-2">
                {isSearching ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--st-accent)]" aria-hidden="true" />
                  </div>
                ) : filteredArticles.length === 0 && searchQuery ? (
                  <EmptyState
                    icon={FileQuestion}
                    title="No articles found"
                    description={`We could not find anything matching "${searchQuery}".`}
                    size="sm"
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredArticles.map((article, i) => (
                      <Button
                        key={i}
                        variant="ghost"
                        className="group w-full h-auto flex-col items-start gap-1 p-3 text-left whitespace-normal rounded-xl border border-transparent hover:border-[var(--st-border)] hover:bg-[var(--st-bg-secondary)]"
                      >
                        <Badge variant="secondary">{article.category}</Badge>
                        <span className="text-sm font-medium text-[var(--st-text)] group-hover:text-[var(--st-accent)] transition-colors">{article.title}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="p-4 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)] text-center">
                <p className="text-xs text-[var(--st-text-secondary)] mb-2">Still need help?</p>
                <Button variant="primary" block onClick={() => setView('chat')}>
                  Chat with Support
                </Button>
              </div>
            </div>
          )}

          {/* 4. CALLING UI (Voice & Video) */}
          {(view === 'voice-call' || view === 'video-call') && (
            <div className="flex flex-col h-full bg-[var(--st-text)] text-white animate-in zoom-in-95 duration-300">
              <div className="flex-1 relative flex flex-col items-center justify-center p-6">

                {view === 'video-call' && (
                  <div className="absolute inset-0 bg-[var(--st-text)] flex items-center justify-center overflow-hidden">
                    {/* Simulated Agent Video Stream */}
                    <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center" />

                    {/* Simulated Self Video Stream (Picture in Picture) */}
                    <div className="absolute bottom-6 right-4 w-24 h-36 bg-[var(--st-text)] rounded-lg border-2 border-[var(--st-border)] shadow-xl overflow-hidden">
                      <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1568602471122-7832951cc4c5?q=80&w=300&auto=format&fit=crop')] bg-cover bg-center" />
                    </div>
                  </div>
                )}

                <div className={`relative z-10 flex flex-col items-center ${view === 'video-call' ? 'mt-[-150px]' : ''}`}>
                  {view === 'voice-call' && (
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-[var(--st-accent)]/20 rounded-full animate-ping" />
                      <Avatar className="h-24 w-24 border-4 border-[var(--st-border)] relative z-10">
                        <AvatarFallback className="bg-[var(--st-text)] text-3xl">S</AvatarFallback>
                      </Avatar>
                    </div>
                  )}

                  <h3 className="text-xl font-semibold mb-1 shadow-black drop-shadow-md">SabChat Agent</h3>
                  <p className="text-sm text-[var(--st-text-secondary)] font-mono shadow-black drop-shadow-md">
                    {isCalling ? formatTime(callDuration) : 'Connecting...'}
                  </p>
                </div>

              </div>

              <div className="bg-[var(--st-text)]/90 backdrop-blur-md p-6 rounded-t-3xl border-t border-[var(--st-border)] flex justify-center gap-6 relative z-10">
                <IconButton
                  label="Mute microphone"
                  icon={Mic}
                  className="h-12 w-12 rounded-full bg-[var(--st-text)] text-white"
                />
                <IconButton
                  label={view === 'video-call' ? 'Turn camera off' : 'Turn camera on'}
                  icon={view === 'video-call' ? Video : VideoOff}
                  className="h-12 w-12 rounded-full bg-[var(--st-text)] text-white"
                />
                <IconButton
                  label="End call"
                  icon={PhoneCall}
                  variant="danger"
                  onClick={handleEndCall}
                  className="h-12 w-12 rounded-full text-white shadow-lg [&_svg]:rotate-[135deg]"
                />
              </div>
            </div>
          )}

          {/* 5. CO-BROWSE UI */}
          {view === 'co-browse' && (
            <div className="flex flex-col h-full bg-[var(--st-text)] text-white animate-in zoom-in-95 duration-300">
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-[var(--st-text)]/20 rounded-full animate-pulse blur-xl" />
                  <div className="h-20 w-20 bg-[var(--st-text)] rounded-2xl flex items-center justify-center relative z-10 shadow-2xl rotate-3 border border-[var(--st-border)]/30">
                    <MousePointer2 className="h-10 w-10 text-white" aria-hidden="true" />
                  </div>
                </div>

                <h3 className="text-xl font-semibold mb-2">Co-browsing Active</h3>
                <p className="text-sm text-white mb-6 max-w-[250px]">
                  An agent is currently viewing your screen to help you navigate.
                </p>

                <div className="bg-[var(--st-text)]/50 border border-[var(--st-border)]/30 rounded-xl p-4 w-full flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[var(--st-bg-muted)] animate-pulse" />
                  <div className="text-xs text-left flex-1">
                    <span className="font-semibold block text-white">Session ID: 948-234-112</span>
                    <span className="text-[var(--st-text-secondary)]">{formatTime(callDuration)}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <Button
                  variant="danger"
                  block
                  className="h-12 text-md shadow-lg"
                  onClick={handleEndCall}
                >
                  Stop Screen Sharing
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating Toggle Button */}
      <IconButton
        label={isOpen ? 'Close widget' : 'Open widget'}
        icon={isOpen ? X : MessageSquare}
        variant="primary"
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto mt-4 h-14 w-14 shrink-0 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-50 [&_svg]:h-6 [&_svg]:w-6"
      />
    </div>
  );
}
