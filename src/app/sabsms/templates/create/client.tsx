"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Save, 
  Variable, 
  AlertCircle,
  Settings,
  AlignLeft,
  Hash,
  AlertTriangle,
  DownloadCloud,
  Loader2
} from "lucide-react";

const EXISTING_TEMPLATES = [
  { id: 't1', name: 'Standard Reminder', content: 'Hi {{name}},\n\nYour appointment is confirmed for {{date}} at {{time}}.\n\nReply Y to confirm.' },
  { id: 't2', name: 'OTP Verification', content: 'Your login OTP is {{otp}}. Valid for 10 minutes.' }
];

const MOCK_DLT_TEMPLATES = [
  {
    dltId: "1205161045234567890",
    name: "Account Verification",
    content: "Your SabNode verification code is {{code}}. Do not share this with anyone."
  },
  {
    dltId: "1205161045234567891",
    name: "Order Shipped",
    content: "Hi {{name}}, your order #{{order_id}} has been shipped and will reach you by {{date}}."
  }
];

async function generateHash(text: string) {
  const msgBuffer = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const GSM7_CHARSET = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

const isGSM7 = (str: string) => {
  for (let i = 0; i < str.length; i++) {
    if (!GSM7_CHARSET.includes(str[i]) && !['^', '{', '}', '[', ']', '~', '|', '€', '\\'].includes(str[i])) {
      return false;
    }
  }
  return true;
};

const getSMSInfo = (text: string) => {
  const gsm7 = isGSM7(text);
  let len = text.length;
  
  const extChars = ['^', '{', '}', '[', ']', '~', '|', '€', '\\'];
  if (gsm7) {
    for (let i = 0; i < text.length; i++) {
      if (extChars.includes(text[i])) len++;
    }
  }

  const maxLen = gsm7 ? 160 : 70;
  let parts = 1;
  let remaining = maxLen - len;
  
  if (len > maxLen) {
    const multiMaxLen = gsm7 ? 153 : 67;
    parts = Math.ceil(len / multiMaxLen);
    remaining = (parts * multiMaxLen) - len;
  } else if (len === 0) {
    remaining = maxLen;
  }
  
  return { gsm7, len, parts, remaining };
};

export default function CreateSMSTemplatePage() {
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("Hi {{name}},\n\nYour appointment is confirmed for {{date}} at {{time}}.\n\nReply Y to confirm.");
  const [variables, setVariables] = useState<Record<string, string>>({
    name: "John Doe",
    date: "Oct 24",
    time: "10:00 AM"
  });

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isDltDialogOpen, setIsDltDialogOpen] = useState(false);
  const [isFetchingDlt, setIsFetchingDlt] = useState(false);
  const [dltTemplatesFetched, setDltTemplatesFetched] = useState(false);

  const handleFetchDlt = () => {
    setIsFetchingDlt(true);
    setTimeout(() => {
      setIsFetchingDlt(false);
      setDltTemplatesFetched(true);
    }, 1500);
  };

  useEffect(() => {
    let isMounted = true;
    const checkDuplicate = async () => {
      if (!templateContent.trim()) {
        if (isMounted) setDuplicateWarning(null);
        return;
      }
      const currentHash = await generateHash(templateContent);
      let foundDuplicate = null;
      for (const tpl of EXISTING_TEMPLATES) {
        const tplHash = await generateHash(tpl.content);
        if (currentHash === tplHash) {
          foundDuplicate = tpl.name;
          break;
        }
      }
      if (isMounted) {
        setDuplicateWarning(foundDuplicate);
      }
    };
    checkDuplicate();
    return () => { isMounted = false; };
  }, [templateContent]);

  const extractedVariables = useMemo(() => {
    const regex = /{{([^}]+)}}/g;
    const matches = Array.from(templateContent.matchAll(regex));
    return Array.from(new Set(matches.map(m => m[1].trim())));
  }, [templateContent]);

  useEffect(() => {
    setVariables(prev => {
      const newVars = { ...prev };
      let changed = false;
      extractedVariables.forEach(v => {
        if (newVars[v] === undefined) {
          newVars[v] = "";
          changed = true;
        }
      });
      Object.keys(newVars).forEach(k => {
        if (!extractedVariables.includes(k)) {
          delete newVars[k];
          changed = true;
        }
      });
      if (changed) return newVars;
      return prev;
    });
  }, [extractedVariables]);

  const handleVariableChange = (name: string, value: string) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const previewContent = useMemo(() => {
    let result = templateContent;
    Object.entries(variables).forEach(([k, v]) => {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      result = result.replace(regex, v || `{{${k}}}`);
    });
    return result;
  }, [templateContent, variables]);

  const smsInfo = useMemo(() => getSMSInfo(previewContent), [previewContent]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)] bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-card">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Template</h1>
          <p className="text-muted-foreground text-sm mt-1">Design, test, and save SMS templates with rich variable support.</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isDltDialogOpen} onOpenChange={(open) => {
            setIsDltDialogOpen(open);
            if (!open) {
              setTimeout(() => setDltTemplatesFetched(false), 200); // reset state when closed
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
                <DownloadCloud className="w-4 h-4" />
                Import from DLT
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Import DLT Templates</DialogTitle>
                <DialogDescription>
                  Connect to your DLT portal to fetch approved templates directly.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {isFetchingDlt ? (
                  <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Connecting to DLT operator...</p>
                  </div>
                ) : dltTemplatesFetched ? (
                  <div className="space-y-3">
                    {MOCK_DLT_TEMPLATES.map(tpl => (
                      <div key={tpl.dltId} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{tpl.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">ID: {tpl.dltId}</p>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            setTemplateName(tpl.name);
                            setTemplateContent(tpl.content);
                            setIsDltDialogOpen(false);
                          }}
                        >
                          Import
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pe-id">Principal Entity ID</Label>
                      <Input id="pe-id" placeholder="1201..." />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="api-key">API Key</Label>
                      <Input id="api-key" type="password" />
                    </div>
                    <Button onClick={handleFetchDlt} className="w-full">
                      Fetch Templates
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline">Discard</Button>
          <Button className="gap-2">
            <Save className="w-4 h-4" />
            Save Template
          </Button>
        </div>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-none border-none h-[calc(100vh-8rem)]">
        <ResizablePanel defaultSize={55} minSize={40} className="bg-muted/10 h-full">
          <ScrollArea className="h-full w-full">
            <div className="p-6 space-y-6">
              
              {duplicateWarning && (
                <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Duplicate Template Detected</AlertTitle>
                  <AlertDescription>
                    The content you entered matches an existing template: <strong>{duplicateWarning}</strong>. 
                    Please consider using the existing template to avoid duplicate records.
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Template Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Appointment Reminder" 
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Input 
                      id="category" 
                      placeholder="e.g. Marketing, Transactional" 
                      className="bg-background"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm border-primary/20">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlignLeft className="w-5 h-5 text-primary" />
                    Message Content
                  </CardTitle>
                  <CardDescription>
                    Use {'{{variable_name}}'} syntax to insert dynamic content.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <Textarea 
                      placeholder="Type your message here..." 
                      className="min-h-[200px] resize-y bg-background font-mono text-sm leading-relaxed"
                      value={templateContent}
                      onChange={(e) => setTemplateContent(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              {extractedVariables.length > 0 && (
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Variable className="w-5 h-5 text-primary" />
                      Variable Editor
                    </CardTitle>
                    <CardDescription>
                      Provide mock values to preview your message realistically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {extractedVariables.map((v) => (
                        <div key={v} className="grid gap-2">
                          <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <span className="text-primary font-mono lowercase">{'{{'}</span>
                            {v}
                            <span className="text-primary font-mono lowercase">{'}}'}</span>
                          </Label>
                          <Input 
                            value={variables[v] || ""}
                            onChange={(e) => handleVariableChange(v, e.target.value)}
                            placeholder={`Mock ${v}`}
                            className="bg-background"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border/60 hover:bg-primary/50 transition-colors" />

        <ResizablePanel defaultSize={45} minSize={30} className="bg-card h-full">
          <ScrollArea className="h-full w-full">
            <div className="p-6 space-y-6 flex flex-col items-center">
              
              <div className="w-full max-w-md space-y-6">
                
                <Card className="shadow-md border-border/50 overflow-hidden relative">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/40" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <Hash className="w-4 h-4" />
                      Delivery Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Encoding</p>
                        <div className="flex items-center mt-1">
                          {smsInfo.gsm7 ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/20 text-xs px-1.5 py-0">
                              GSM-7
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 text-xs px-1.5 py-0">
                              Unicode
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Length</p>
                        <p className="text-2xl font-semibold tracking-tight leading-none mt-1">{smsInfo.len}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Parts</p>
                        <p className="text-2xl font-semibold tracking-tight leading-none mt-1">{smsInfo.parts}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Remaining</p>
                        <p className="text-2xl font-semibold tracking-tight leading-none mt-1">{smsInfo.remaining}</p>
                      </div>
                    </div>

                    {!smsInfo.gsm7 && (
                      <div className="mt-4 flex items-start gap-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-3 rounded-md text-sm border border-yellow-500/20">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-xs">Non-GSM characters detected. Message length reduced to 70 chars per part.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-center pt-4">
                  <div className="relative border-[8px] border-zinc-900 rounded-[2.5rem] h-[600px] w-[300px] bg-white dark:bg-black shadow-2xl overflow-hidden ring-1 ring-border/20">
                    
                    <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
                      <div className="w-24 h-5 bg-zinc-900 rounded-b-xl" />
                    </div>

                    <div className="absolute top-0 inset-x-0 h-20 bg-zinc-100 dark:bg-zinc-900/50 backdrop-blur-md border-b z-10 flex flex-col justify-end px-4 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-500 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          Messages
                        </span>
                        <span className="text-sm font-semibold flex items-center gap-1">
                          <MessageSquare className="w-4 h-4 fill-current opacity-80" />
                          SabNode
                        </span>
                        <span className="w-16" />
                      </div>
                    </div>

                    <div className="h-full pt-24 pb-20 px-4 flex flex-col justify-end bg-slate-50 dark:bg-zinc-950 overflow-y-auto">
                      <div className="flex justify-center mb-4">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Today 10:41 AM</span>
                      </div>
                      
                      <div className="flex justify-start mb-2">
                        <div className="bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] shadow-sm text-[15px] leading-snug whitespace-pre-wrap font-sans relative">
                          {previewContent || "Type a message..."}
                        </div>
                      </div>
                      
                    </div>

                    <div className="absolute bottom-0 inset-x-0 h-16 bg-zinc-100 dark:bg-zinc-900/80 backdrop-blur-md border-t flex items-center px-4 gap-3 z-10">
                      <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <div className="h-9 flex-1 bg-white dark:bg-zinc-800 rounded-full border dark:border-zinc-700 flex items-center px-3">
                        <span className="text-xs text-muted-foreground">iMessage</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          </ScrollArea>
        </ResizablePanel>

      </ResizablePanelGroup>
    </div>
  );
}
