'use client';

import { Alert, AlertDescription, AlertTitle, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, EmptyState, Input, Label, Skeleton, Textarea, zoruSonnerToast } from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Trash2,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteMessengerProfileFields,
  getMessengerProfile,
  setMessengerGetStarted,
  setMessengerGreeting,
  setMessengerIceBreakers,
  setWhitelistedDomains,
  } from '@/app/actions/facebook.actions';

/**
 * /dashboard/facebook/messenger-settings — Messenger profile settings.
 *
 * Wraps the Messenger profile fields exposed by
 * `wachat-facebook-messenger-profile`: greeting, get-started payload, ice
 * breakers, and whitelisted domains. Each section saves independently and
 * supports deletion via `deleteMessengerProfileFields`.
 */

import * as React from 'react';

interface IceBreaker {
  question: string;
  payload: string;
}

interface GreetingEntry {
  locale?: string;
  text: string;
}

interface Profile {
  greeting?: string | GreetingEntry[];
  get_started?: { payload?: string };
  ice_breakers?: IceBreaker[];
  whitelisted_domains?: string[];
  persistent_menu?: unknown;
}

function normalizeGreeting(g: Profile['greeting']): string {
  if (!g) return '';
  if (typeof g === 'string') return g;
  if (Array.isArray(g)) {
    const def = g.find((x) => !x.locale || x.locale === 'default') ?? g[0];
    return def?.text ?? '';
  }
  return '';
}

export default function MessengerSettingsPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [profile, setProfile] = useState<Profile>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  const [greeting, setGreeting] = useState('');
  const [getStarted, setGetStarted] = useState('');
  const [iceBreakers, setIceBreakers] = useState<IceBreaker[]>([]);
  const [domainsInput, setDomainsInput] = useState('');

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getMessengerProfile(projectId);
      if (res.error) {
        setError(res.error);
        setProfile({});
        return;
      }
      setError(null);
      const p: Profile = (res.profile as Profile) ?? {};
      setProfile(p);
      setGreeting(normalizeGreeting(p.greeting));
      setGetStarted(p.get_started?.payload ?? '');
      setIceBreakers(
        (p.ice_breakers ?? []).map((ib) => ({
          question: ib.question ?? '',
          payload: ib.payload ?? '',
        })),
      );
      setDomainsInput((p.whitelisted_domains ?? []).join(', '));
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveGreeting = () => {
    if (!projectId) return;
    startSaving(async () => {
      const res = await setMessengerGreeting(projectId, greeting);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Greeting saved.');
      refresh();
    });
  };

  const deleteGreeting = () => {
    if (!projectId) return;
    startSaving(async () => {
      const res = await deleteMessengerProfileFields(projectId, ['greeting']);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      setGreeting('');
      zoruSonnerToast.success('Greeting cleared.');
      refresh();
    });
  };

  const saveGetStarted = () => {
    if (!projectId) return;
    startSaving(async () => {
      const res = await setMessengerGetStarted(projectId, getStarted);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Get-started payload saved.');
      refresh();
    });
  };

  const deleteGetStarted = () => {
    if (!projectId) return;
    startSaving(async () => {
      const res = await deleteMessengerProfileFields(projectId, ['get_started']);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      setGetStarted('');
      zoruSonnerToast.success('Get-started cleared.');
      refresh();
    });
  };

  const saveIceBreakers = () => {
    if (!projectId) return;
    const cleaned = iceBreakers
      .map((ib) => ({
        question: ib.question.trim(),
        payload: ib.payload.trim(),
      }))
      .filter((ib) => ib.question && ib.payload);
    startSaving(async () => {
      const res = await setMessengerIceBreakers(projectId, cleaned);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Ice breakers saved.');
      refresh();
    });
  };

  const deleteIceBreakers = () => {
    if (!projectId) return;
    startSaving(async () => {
      const res = await deleteMessengerProfileFields(projectId, ['ice_breakers']);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      setIceBreakers([]);
      zoruSonnerToast.success('Ice breakers cleared.');
      refresh();
    });
  };

  const saveDomains = () => {
    if (!projectId) return;
    const domains = domainsInput
      .split(/[\s,]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    startSaving(async () => {
      const res = await setWhitelistedDomains(projectId, domains);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success('Whitelisted domains saved.');
      refresh();
    });
  };

  const deleteDomains = () => {
    if (!projectId) return;
    startSaving(async () => {
      const res = await deleteMessengerProfileFields(projectId, [
        'whitelisted_domains',
      ]);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      setDomainsInput('');
      zoruSonnerToast.success('Whitelisted domains cleared.');
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<MessageSquare />}
          title="No project selected"
          description="Pick a Facebook project to edit its Messenger profile."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Messenger settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Messenger settings</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Greeting, get-started button, ice breakers, and whitelisted domains
            for the connected Page.
          </p>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load Messenger profile</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !profile ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Greeting */}
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base text-[var(--st-text)]">Greeting</h2>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Shown to first-time visitors before they message your Page.
                </p>
              </div>
            </div>
            <Textarea
              rows={3}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Hi! Welcome to our Page. How can we help?"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteGreeting}
                disabled={saving}
              >
                Clear
              </Button>
              <Button size="sm" onClick={saveGreeting} disabled={saving}>
                {saving ? 'Saving…' : 'Save greeting'}
              </Button>
            </div>
          </Card>

          {/* Get started */}
          <Card className="flex flex-col gap-3 p-5">
            <div>
              <h2 className="text-base text-[var(--st-text)]">Get-started payload</h2>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Payload sent when a user taps the Get Started button.
              </p>
            </div>
            <Input
              value={getStarted}
              onChange={(e) => setGetStarted(e.target.value)}
              placeholder="GET_STARTED_PAYLOAD"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteGetStarted}
                disabled={saving}
              >
                Clear
              </Button>
              <Button size="sm" onClick={saveGetStarted} disabled={saving}>
                {saving ? 'Saving…' : 'Save payload'}
              </Button>
            </div>
          </Card>

          {/* Ice breakers */}
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base text-[var(--st-text)]">Ice breakers</h2>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Pre-set questions shown to users before they start chatting.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setIceBreakers((p) => [...p, { question: '', payload: '' }])
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {iceBreakers.length === 0 ? (
              <p className="text-xs text-[var(--st-text-secondary)]">No ice breakers set.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {iceBreakers.map((ib, i) => (
                  <li key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px]">Question</Label>
                      <Input
                        value={ib.question}
                        onChange={(e) =>
                          setIceBreakers((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, question: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="What are your hours?"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-[11px]">Payload</Label>
                      <Input
                        value={ib.payload}
                        onChange={(e) =>
                          setIceBreakers((p) =>
                            p.map((x, j) =>
                              j === i ? { ...x, payload: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="HOURS_PAYLOAD"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setIceBreakers((p) => p.filter((_, j) => j !== i))
                        }
                        aria-label="Remove ice breaker"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteIceBreakers}
                disabled={saving}
              >
                Clear all
              </Button>
              <Button size="sm" onClick={saveIceBreakers} disabled={saving}>
                {saving ? 'Saving…' : 'Save ice breakers'}
              </Button>
            </div>
          </Card>

          {/* Whitelisted domains */}
          <Card className="flex flex-col gap-3 p-5">
            <div>
              <h2 className="text-base text-[var(--st-text)]">Whitelisted domains</h2>
              <p className="text-xs text-[var(--st-text-secondary)]">
                Comma- or space-separated list of domains allowed in webviews
                and link previews.
              </p>
            </div>
            <Input
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
              placeholder="https://example.com, https://shop.example.com"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteDomains}
                disabled={saving}
              >
                Clear
              </Button>
              <Button size="sm" onClick={saveDomains} disabled={saving}>
                {saving ? 'Saving…' : 'Save domains'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
