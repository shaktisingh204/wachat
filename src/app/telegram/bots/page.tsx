'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from '@/context/project-context';
import {
  Card,
  Button,
  Input,
  Label,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Select,
  Textarea,
  Badge,
  Skeleton,
  Separator,
} from '@/components/zoruui';
import { useToast } from '@/hooks/use-toast';
import { Bot, Save, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import {
  listTelegramBotsAction,
  setTelegramBotNameAction,
  setTelegramBotDescriptionAction,
  setTelegramBotShortDescriptionAction,
} from '@/app/actions/telegram-extra.actions';
import type { BotRow } from '@/lib/rust-client/telegram-bots';

export default function BotProfileManagerPage() {
  const { activeProjectId } = useProject();
  const { toast } = useToast();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [selectedBotId, setSelectedBotId] = useState<string>('');

  useEffect(() => {
    async function loadBots() {
      if (!activeProjectId) {
        setLoadingBots(false);
        return;
      }
      setLoadingBots(true);
      try {
        const res = await listTelegramBotsAction({ projectId: activeProjectId, pageSize: 100 });
        if (res.bots) {
          setBots(res.bots);
          if (res.bots.length > 0) {
            setSelectedBotId(res.bots[0]._id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBots(false);
      }
    }
    loadBots();
  }, [activeProjectId]);

  const selectedBot = bots.find((b) => b._id === selectedBotId);

  return (
    <div className="flex flex-col h-full w-full p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bot Profile Manager</h1>
        <p className="text-muted-foreground">
          Manage your Telegram bot profiles including names, descriptions, and language-specific text.
        </p>
      </div>

      {!activeProjectId ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Project Selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select a project from the project switcher to manage bots.
          </p>
        </Card>
      ) : loadingBots ? (
        <div className="space-y-4">
          <Skeleton className="h-[60px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : bots.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4">
          <Bot className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Bots Found</h3>
          <p className="text-sm text-muted-foreground">
            Connect a Telegram bot to this project first.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <Label>Select Bot</Label>
                <div className="w-[280px]">
                  <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                    <ZoruSelectTrigger>
                      <ZoruSelectValue placeholder="Choose a bot" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                      {bots.map((bot) => (
                        <ZoruSelectItem key={bot._id} value={bot._id}>
                          {bot.name} (@{bot.username})
                        </ZoruSelectItem>
                      ))}
                    </ZoruSelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {selectedBot && (
              <div className="flex items-center space-x-2">
                <Badge variant={selectedBot.isActive ? 'default' : 'secondary'}>
                  {selectedBot.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {selectedBot.status && (
                  <Badge variant="outline" className="capitalize">
                    {selectedBot.status}
                  </Badge>
                )}
              </div>
            )}
          </Card>

          {selectedBot && (
            <BotProfileEditor 
              bot={selectedBot} 
              projectId={activeProjectId} 
              toast={toast}
              onMutated={() => {
                // optionally refresh list if name changes
              }} 
            />
          )}
        </div>
      )}
    </div>
  );
}

function BotProfileEditor({
  bot,
  projectId,
  toast,
  onMutated,
}: {
  bot: BotRow;
  projectId: string;
  toast: any;
  onMutated: () => void;
}) {
  const [name, setName] = useState(bot.name || '');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [busy, setBusy] = useState<'name' | 'desc' | 'short' | null>(null);

  // Sync state if bot changes
  useEffect(() => {
    setName(bot.name || '');
    setDescription('');
    setShortDescription('');
  }, [bot._id, bot.name]);

  async function saveName() {
    setBusy('name');
    const res = await setTelegramBotNameAction({
      botId: bot._id,
      projectId,
      name,
      languageCode: languageCode || undefined,
    });
    setBusy(null);
    if (res.success) {
      toast({ title: 'Name updated successfully.' });
      onMutated();
    } else {
      toast({
        title: 'Failed to update name',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  async function saveDescription() {
    setBusy('desc');
    const res = await setTelegramBotDescriptionAction({
      botId: bot._id,
      projectId,
      description,
      languageCode: languageCode || undefined,
    });
    setBusy(null);
    if (res.success) {
      toast({ title: 'Description updated successfully.' });
    } else {
      toast({
        title: 'Failed to update description',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  async function saveShortDescription() {
    setBusy('short');
    const res = await setTelegramBotShortDescriptionAction({
      botId: bot._id,
      projectId,
      shortDescription,
      languageCode: languageCode || undefined,
    });
    setBusy(null);
    if (res.success) {
      toast({ title: 'Short description updated successfully.' });
    } else {
      toast({
        title: 'Failed to update short description',
        description: res.error,
        variant: 'destructive',
      });
    }
  }

  return (
    <Card className="p-6 space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div>
            <h3 className="text-lg font-medium">Localization</h3>
            <p className="text-sm text-muted-foreground">
              Select a language code if you want to update language-specific text.
            </p>
          </div>
          <div className="w-full sm:w-[200px]">
            <Input
              placeholder="e.g. en, es, ru (optional)"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Name */}
          <div className="space-y-3">
            <Label htmlFor="bot-name">Bot Name</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="bot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The name displayed in chats."
                className="flex-1"
              />
              <Button onClick={saveName} disabled={busy !== null} className="w-full sm:w-auto shrink-0">
                {busy === 'name' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Name
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Changes the bot's name in the contacts list and chat headers.
            </p>
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-3">
            <Label htmlFor="bot-desc">Description (About text)</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Textarea
                id="bot-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown on the bot's profile page and when someone opens a chat with the bot for the first time."
                className="flex-1 min-h-[100px]"
              />
              <Button onClick={saveDescription} disabled={busy !== null} className="w-full sm:w-auto shrink-0 items-start">
                {busy === 'desc' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This text is displayed when a user opens a chat with your bot but hasn't started it yet. (Max 512 chars)
            </p>
          </div>

          <Separator />

          {/* Short Description */}
          <div className="space-y-3">
            <Label htmlFor="bot-short-desc">Short Description</Label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="bot-short-desc"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Shown on the bot's profile page."
                className="flex-1"
              />
              <Button onClick={saveShortDescription} disabled={busy !== null} className="w-full sm:w-auto shrink-0">
                {busy === 'short' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This text is shown on the bot's profile page and is sent together with the link when users share the bot. (Max 120 chars)
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
