'use client';

import React, { useRef, useState } from 'react';
import {
  Card,
  Field,
  Input,
  IconButton,
  ScrollArea,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';
import { Bot, Sparkles, TerminalSquare, User } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsapCore from 'gsap';

gsapCore.registerPlugin(useGSAP);

export default function OmnibarPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string | React.ReactNode }[]>([
    {
      role: 'ai',
      content: 'Hello! I am your SabFinance AI Assistant. Ask me anything about your ledgers, or tell me to generate a voucher.',
    },
  ]);

  useGSAP(
    () => {
      gsapCore.from('.animate-message', {
        y: 10,
        opacity: 0,
        stagger: 0.1,
        duration: 0.3,
        ease: 'power2.out',
      });
    },
    { scope: containerRef, dependencies: [messages] },
  );

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    const currentQuery = query.toLowerCase();
    setQuery('');

    // Simulated AI Processing
    setTimeout(() => {
      let aiResponse: React.ReactNode =
        "I'm sorry, I didn't quite catch that. Try asking about your software expenses or generating a voucher.";

      if (currentQuery.includes('software expenses')) {
        aiResponse = (
          <div className="space-y-2">
            <p>
              Your software expenses for the last quarter were <strong>₹45,200</strong>.
            </p>
            <div className="h-32 w-full bg-[var(--st-bg-muted)] flex items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] text-xs text-[var(--st-text-secondary)]">
              [ Bar Chart: WebGL Visualization of Expenses ]
            </div>
          </div>
        );
      } else if (currentQuery.includes('voucher') || currentQuery.includes('payment')) {
        aiResponse = "I've drafted a Payment Voucher for you. Would you like to review it in the Multiplayer Ledger?";
      }

      setMessages((prev) => [...prev, { role: 'ai', content: aiResponse }]);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, 800);
  };

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-64px)] flex flex-col" ref={containerRef}>
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <TerminalSquare className="w-7 h-7 text-[var(--st-text)]" aria-hidden="true" />
            The Omnibar
          </PageTitle>
          <PageDescription>
            Natural language querying and AI-assisted ledger actions.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card padding="none" className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Abstract background for an advanced-AI feel */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--st-accent-soft)] to-transparent pointer-events-none" />

        <ScrollArea className="flex-1" viewportClassName="p-4">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`animate-message flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-[var(--st-accent-soft)] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" />
                  </div>
                )}

                <div
                  className={`px-4 py-3 rounded-2xl max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)] rounded-tr-sm'
                      : 'bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-tl-sm shadow-[var(--st-shadow-sm)]'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
          <form onSubmit={handleQuery} className="max-w-4xl mx-auto flex gap-2 items-end">
            <Field label="Ask SabFinance AI" className="flex-1 [&>.u-field__label]:sr-only">
              <Input
                inputSize="lg"
                iconLeft={Sparkles}
                placeholder="Ask SabFinance AI (e.g., 'What were my software expenses last quarter?')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </Field>
            <IconButton type="submit" variant="primary" size="lg" label="Send query" icon={Bot} />
          </form>
        </div>
      </Card>
    </div>
  );
}
