import * as React from 'react';
import { useState } from 'react';
import { Input, Button } from '@/components/zoruui';
import { Wand, Sparkles } from 'lucide-react';

export function AIBodyGenerator({
  onGenerate,
}: {
  onGenerate: (text: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [open, setOpen] = useState(false);

  const generate = () => {
    if (!prompt.trim()) return;
    const templates: Record<string, string> = {
      welcome:
        "Hello {{1}}! 👋 Welcome to our store. We're excited to have you here. Browse our latest collection and enjoy exclusive deals just for you!",
      order:
        'Hi {{1}}, your order #{{2}} has been {{3}}. Track your delivery at {{4}}. Thank you for shopping with us!',
      appointment:
        'Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}. Reply YES to confirm or NO to reschedule.',
      promo:
        '🎉 Exclusive offer for {{1}}! Get {{2}}% OFF on your next purchase. Use code: {{3}}. Valid until {{4}}. Shop now!',
      feedback:
        "Hi {{1}}, we hope you enjoyed your recent experience with us! We'd love to hear your feedback. Rate us from 1-5 by replying with a number.",
      payment:
        'Hi {{1}}, your payment of {{2}} for invoice #{{3}} has been received. Thank you!',
    };

    const key = Object.keys(templates).find((k) =>
      prompt.toLowerCase().includes(k),
    );
    onGenerate(
      key ? templates[key] : `Hi {{1}}, ${prompt}. Thank you for choosing us!`,
    );
    setOpen(false);
    setPrompt('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
      >
        <Wand className="h-3 w-3" /> Generate with AI
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zoru-ink">
        <Sparkles className="h-3 w-3" /> AI Body Generator
      </div>
      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your message (e.g., 'order confirmation with tracking')"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={generate}>
          Generate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
