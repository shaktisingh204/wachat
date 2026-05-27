'use client';

import * as React from 'react';
import { Sparkles, LoaderCircle, Check, Copy, RefreshCw, Send, ArrowRight } from 'lucide-react';
import { Button, Textarea, Label, Select, ZoruSelectTrigger, ZoruSelectValue, ZoruSelectContent, ZoruSelectItem, Badge } from '@/components/zoruui';
import { cn } from '@/components/zoruui/lib/cn';

interface AiCopilotPanelProps {
    templateType: 'email' | 'sms' | 'whatsapp' | 'document';
    onInsert: (text: string) => void;
    currentContent?: string;
}

export function AiCopilotPanel({ templateType, onInsert, currentContent }: AiCopilotPanelProps): React.JSX.Element {
    const [prompt, setPrompt] = React.useState('');
    const [tone, setTone] = React.useState('professional');
    const [loading, setLoading] = React.useState(false);
    const [suggestions, setSuggestions] = React.useState<string[]>([]);
    const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

    const handleQuickPrompt = (p: string) => {
        setPrompt(p);
    };

    const handleGenerate = () => {
        if (!prompt.trim()) return;
        setLoading(true);
        setTimeout(() => {
            let options: string[] = [];
            const lowercasePrompt = prompt.toLowerCase();
            const toneLabel = tone.charAt(0).toUpperCase() + tone.slice(1);
            
            if (templateType === 'email') {
                if (lowercasePrompt.includes('welcome')) {
                    options = [
                        `✨ Hello {{contact.first_name}},\n\nWelcome to {{company.name}}! We are thrilled to partner with you. Our core focus is rendering high-performance cloud clusters and CRM operations that accelerate your team.\n\nClick the link below to deploy your first pipeline:\n{{onboarding_link}}`,
                        `🚀 Welcome to {{company.name}}, {{contact.first_name}}!\n\nYou're officially in! Our engineering team has provisioned your SabNode Workspace. Let's make sure you have everything required to hit the ground running.`
                    ];
                } else if (lowercasePrompt.includes('due') || lowercasePrompt.includes('payment')) {
                    options = [
                        `⚠️ Urgent Notice: Payment Due\n\nDear {{contact.first_name}},\n\nThis is a friendly reminder that Invoice {{invoice.invoice_number}} totaling {{invoice.total_amount}} is scheduled for due date {{invoice.due_date}}. Please clear all outstanding charges via your billing dashboard.`,
                        `🚨 Action Required: Invoice {{invoice.invoice_number}} Overdue\n\nHello {{contact.first_name}},\n\nWe noticed that payment of {{invoice.total_amount}} has passed its due date. Please ensure prompt transaction clearance to avoid any server limitations.`
                    ];
                } else {
                    options = [
                        `💡 Hello {{contact.first_name}},\n\nFollowing up on our conversation at {{company.name}}, we are excited to showcase our visual templates module. This has been fully optimized under a ${toneLabel} tone to elevate user experiences.`,
                        `✨ Custom Content Brief for {{contact.first_name}}\n\nHere is the customized brief generated in a ${toneLabel} manner to match your CRM objectives.`
                    ];
                }
            } else if (templateType === 'whatsapp') {
                options = [
                    `🎉 *Excellent news, {{contact.first_name}}!* Your request has been approved. Under *{{company.name}}*, we strive for perfection. Let's execute!`,
                    `👋 *Hi {{contact.first_name}}!* Quick update regarding your quotation. We've customized the proposal under a *${toneLabel}* layout.`
                ];
            } else if (templateType === 'sms') {
                options = [
                    `Alert: Hi {{contact.first_name}}, your deal {{deal.title}} is now active in SabNode! Total: {{deal.amount}}. Info: {{contact.phone}}`,
                    `SabNode Alert: Hello {{contact.first_name}}, urgent task update regarding your workspace at {{company.name}}. Please check dashboard immediately.`
                ];
            } else {
                options = [
                    `Subject: Premium Executive Summary for {{contact.first_name}} ${toneLabel} copy.\n\nThis contract is signed and validated under SabNode standards.`,
                    `Company: {{company.name}}\n\nValid until June 2026. Approved by {{company.signature}}.`
                ];
            }

            setSuggestions(options);
            setLoading(false);
        }, 1200);
    };

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const quickPrompts = {
        email: ['Write a Welcome Email', 'Write a Payment Due Notice', 'Enhance follow up text'],
        sms: ['Draft account alert', 'Write promo discount code', 'Write booking details'],
        whatsapp: ['Write deal closed text', 'Create interactive CTA text', 'Draft order dispatch status'],
        document: ['Write statutory legal notice', 'Write contract introduction', 'Draft signature clause']
    };

    return (
        <div className="flex h-full flex-col gap-4 p-4 text-zoru-ink">
            <div className="flex items-center gap-2 border-b border-zoru-line pb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zoru-ink/20 text-zoru-ink-muted">
                    <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                </div>
                <div>
                    <h3 className="font-semibold text-sm">AI Content Optimizer</h3>
                    <p className="text-[11px] text-zoru-ink-muted">Generate high-converting template copy</p>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ai-tone" className="text-xs font-medium">Tone of Voice</Label>
                    <Select value={tone} onValueChange={setTone}>
                        <ZoruSelectTrigger id="ai-tone" className="h-8.5 text-xs bg-zoru-ink/40 border-zoru-line">
                            <ZoruSelectValue placeholder="Select tone" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent className="bg-zoru-ink border-zoru-line">
                            <ZoruSelectItem value="professional">💼 Professional / Corporate</ZoruSelectItem>
                            <ZoruSelectItem value="friendly">👋 Friendly / Warm</ZoruSelectItem>
                            <ZoruSelectItem value="empathy">❤️ Empathetic / Supportive</ZoruSelectItem>
                            <ZoruSelectItem value="urgent">🚨 Urgent / Crucial</ZoruSelectItem>
                            <ZoruSelectItem value="humorous">😄 Humorous / Playful</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ai-prompt" className="text-xs font-medium">What should the template say?</Label>
                    <Textarea
                        id="ai-prompt"
                        placeholder="e.g. Write a friendly welcome email that requests them to click a setup link..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[80px] text-xs bg-zoru-ink/40 border-zoru-line focus:border-zoru-line/50 resize-none font-sans"
                    />
                </div>

                <Button 
                    onClick={handleGenerate} 
                    disabled={loading || !prompt.trim()} 
                    className="w-full h-8.5 bg-gradient-to-r from-zoru-ink to-zoru-ink hover:from-zoru-ink hover:to-zoru-ink text-white font-medium text-xs rounded-md shadow-lg shadow-zoru-line/20"
                >
                    {loading ? (
                        <>
                            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Optimizing copy...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                            Generate Premium Content
                        </>
                    )}
                </Button>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-zoru-ink-muted uppercase tracking-wider">Quick Suggestions</span>
                <div className="flex flex-wrap gap-1.5">
                    {quickPrompts[templateType].map((qp, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleQuickPrompt(qp)}
                            className="rounded-full bg-zoru-ink hover:bg-zoru-ink border border-zoru-line hover:border-zoru-line px-2.5 py-1 text-[11px] text-zoru-ink-muted hover:text-zoru-ink transition-colors text-left"
                        >
                            {qp}
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Results */}
            <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                <span className="text-[11px] font-semibold text-zoru-ink-muted uppercase tracking-wider border-t border-zoru-line/80 pt-3">Generated Variations</span>
                
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                    {suggestions.length > 0 ? (
                        suggestions.map((sug, idx) => (
                            <div key={idx} className="group relative flex flex-col gap-2 rounded-lg border border-zoru-line bg-zoru-ink/20 hover:bg-zoru-ink/20 p-3 transition-colors">
                                <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 w-6 p-0 bg-zoru-ink border-zoru-line"
                                        onClick={() => handleCopy(sug, idx)}
                                        title="Copy to clipboard"
                                    >
                                        {copiedIndex === idx ? (
                                            <Check className="h-3 w-3 text-zoru-ink-muted" />
                                        ) : (
                                            <Copy className="h-3 w-3" />
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-6 text-[10px] px-1.5 bg-zoru-ink border-zoru-line text-zoru-ink-muted hover:text-zoru-ink-muted gap-1"
                                        onClick={() => onInsert(sug)}
                                    >
                                        Insert <ArrowRight className="h-2.5 w-2.5" />
                                    </Button>
                                </div>
                                <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zoru-ink-muted pr-12 select-text">
                                    {sug}
                                </div>
                                <div className="text-[9px] text-zoru-ink-muted/70 font-semibold uppercase tracking-widest mt-1">
                                    Variation {idx + 1}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zoru-line bg-zoru-ink/10 p-6 text-center text-xs text-zoru-ink-muted">
                            <Sparkles className="h-8 w-8 text-zoru-ink mb-2" strokeWidth={1} />
                            Provide a prompt above and click generate to view beautiful, customized variations ready to use in your campaign.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
