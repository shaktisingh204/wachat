'use client';

import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/zoruui/card';
import { Input } from '@/components/zoruui/input';
import { Button } from '@/components/zoruui/button';
import { ScrollArea } from '@/components/zoruui/scroll-area';
import { Bot, Sparkles, TerminalSquare, User } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import gsapCore from 'gsap';

gsapCore.registerPlugin(useGSAP);

export default function OmnibarPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string | React.ReactNode }[]>([
    {
      role: 'ai',
      content: "Hello! I am your SabFinance AI Assistant. Ask me anything about your ledgers, or tell me to generate a voucher.",
    }
  ]);

  useGSAP(() => {
    gsapCore.from('.animate-message', {
      y: 10,
      opacity: 0,
      stagger: 0.1,
      duration: 0.3,
      ease: 'power2.out'
    });
  }, { scope: containerRef, dependencies: [messages] });

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    const currentQuery = query.toLowerCase();
    setQuery('');

    // Simulated AI Processing
    setTimeout(() => {
      let aiResponse: React.ReactNode = "I'm sorry, I didn't quite catch that. Try asking about your software expenses or generating a voucher.";
      
      if (currentQuery.includes('software expenses')) {
        aiResponse = (
          <div className="space-y-2">
            <p>Your software expenses for the last quarter were <strong>₹45,200</strong>.</p>
            <div className="h-32 w-full bg-muted flex items-center justify-center rounded-md border text-xs text-muted-foreground">
              [ Bar Chart: WebGL Visualization of Expenses ]
            </div>
          </div>
        );
      } else if (currentQuery.includes('voucher') || currentQuery.includes('payment')) {
        aiResponse = "I've drafted a Payment Voucher for you. Would you like to review it in the Multiplayer Ledger?";
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
      
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    }, 800);
  };

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-64px)] flex flex-col" ref={containerRef}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TerminalSquare className="w-8 h-8 text-primary" />
          The Omnibar
        </h1>
        <p className="text-muted-foreground mt-1">
          Natural language querying and AI-assisted ledger actions.
        </p>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {/* Abstract background for "Advanced AI" feel */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`animate-message flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                
                <div 
                  className={`px-4 py-3 rounded-2xl max-w-[80%] ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-muted rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="p-4 bg-background border-t">
          <form onSubmit={handleQuery} className="max-w-4xl mx-auto flex gap-2 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              className="flex-1 pl-10 pr-4 h-12 text-base rounded-full bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background transition-all"
              placeholder="Ask SabFinance AI (e.g., 'What were my software expenses last quarter?')..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-full shrink-0">
              <Bot className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
