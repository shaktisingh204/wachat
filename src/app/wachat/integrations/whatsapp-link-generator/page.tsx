'use client';

import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  SelectField,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import type { WithId, Project } from '@/lib/definitions';
import { Check, Copy, History, Link as LinkIcon } from 'lucide-react';

import { getProjectById } from '@/app/actions/project.actions';
import {
  listGeneratedLinks,
  saveGeneratedLink,
  shortenLink,
} from '@/app/actions/wachat-link-generator.actions';
import type { SavedLink } from '@/lib/rust-client/wachat-link-generator';
import { useProject } from '@/context/project-context';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat → Integrations → WhatsApp Link Generator (20ui).
 *
 * Generate a `wa.me` click-to-chat link from one of the project's verified
 * phone numbers, optionally with a pre-filled message. The generated link
 * is persisted via the `wachat-link-generator` Rust crate (so it also
 * surfaces on `/wachat/link-tracking`), and the URL can be shortened via
 * the internal shortener (replaces the legacy TinyURL round-trip).
 */
export default function WhatsappLinkGeneratorPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  useEffect(() => {
    const id = activeProject?._id?.toString();
    if (id) {
      startLoadingTransition(async () => {
        const data = await getProjectById(id);
        setProject(data);
      });
    }
  }, [activeProject]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Integrations', href: '/wachat/integrations' },
        { label: 'Link generator' },
      ]}
      title="Link generator"
      description="Create click-to-chat WhatsApp links for this project."
      width="narrow"
    >
      {isLoading ? (
        <Skeleton height={256} className="w-full" />
      ) : !project ? (
        <Alert tone="danger" title="No project selected">
          Please select a project from the main dashboard.
        </Alert>
      ) : (
        <LinkGenerator
          project={project}
          onSaved={(msg) => toast({ title: 'Saved', description: msg, tone: 'success' })}
          onError={(msg) => toast({ title: 'Error', description: msg, tone: 'danger' })}
        />
      )}
    </WachatPage>
  );
}

interface LinkGeneratorProps {
  project: WithId<Project>;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

function LinkGenerator({ project, onSaved, onError }: LinkGeneratorProps) {
  const projectId = project._id.toString();
  const phoneNumbers = project.phoneNumbers ?? [];

  const [selectedPhone, setSelectedPhone] = useState<string>(
    phoneNumbers[0]?.display_phone_number ?? '',
  );
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [shortUrl, setShortUrl] = useState('');

  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  const phoneOptions = useMemo(
    () =>
      phoneNumbers.map((p) => ({
        value: p.display_phone_number,
        label: `${p.display_phone_number} (${p.verified_name})`,
      })),
    [phoneNumbers],
  );

  const cleanPhone = useMemo(
    () => selectedPhone.replace(/\D/g, ''),
    [selectedPhone],
  );

  const generatedLink = useMemo(() => {
    if (!cleanPhone) return '';
    const base = `https://wa.me/${cleanPhone}`;
    return message.trim() ? `${base}?text=${encodeURIComponent(message.trim())}` : base;
  }, [cleanPhone, message]);

  // Reset any previously-shortened URL when the underlying link changes.
  useEffect(() => {
    setShortUrl('');
  }, [generatedLink]);

  const loadLinks = useCallback(async () => {
    setLinksLoading(true);
    setLinksError(null);
    const res = await listGeneratedLinks(projectId);
    if (res.success) {
      setSavedLinks(res.links);
    } else {
      setLinksError(res.error ?? 'Failed to load saved links.');
    }
    setLinksLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const handleShorten = async () => {
    if (!generatedLink) return;
    setIsShortening(true);
    const res = await shortenLink(generatedLink);
    setIsShortening(false);
    if (res.success && res.shortUrl) {
      setShortUrl(res.shortUrl);
      onSaved('Link shortened successfully.');
    } else {
      onError(res.error ?? 'Failed to shorten link.');
    }
  };

  const handleCopy = async () => {
    const toCopy = shortUrl || generatedLink;
    if (!toCopy) return;
    await navigator.clipboard.writeText(toCopy);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);

    // Persist the generated wa.me link (best-effort).
    if (generatedLink) {
      const res = await saveGeneratedLink(projectId, generatedLink, {
        phone: cleanPhone || undefined,
        message: message.trim() || undefined,
      });
      if (res.success) {
        onSaved('Link saved.');
        void loadLinks();
      } else if (res.error) {
        onError(res.error);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4" padding="lg">
        <Field label="Phone Number">
          {phoneOptions.length > 0 ? (
            <SelectField
              value={selectedPhone}
              onChange={(value) => setSelectedPhone(value ?? '')}
              options={phoneOptions}
              placeholder="Select a number..."
            />
          ) : (
            <Input
              id="link-phone-number"
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="font-mono"
            />
          )}
        </Field>

        <Field
          label="Pre-filled Message (optional)"
          help={<span className="block text-right">{message.length}/1024</span>}
        >
          <Textarea
            id="link-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1024}
            placeholder="Hello, I'm interested in your services..."
          />
        </Field>

        {generatedLink ? (
          <Card variant="outlined" padding="sm" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="u-card__desc text-[12px]">Generated Link</span>
              {!shortUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleShorten}
                  disabled={isShortening}
                  className="text-[11px] font-medium"
                >
                  {isShortening ? 'Shortening...' : 'Shorten link'}
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shortUrl || generatedLink}
                className="font-mono text-[12px]"
              />
              <IconButton
                variant="outline"
                size="sm"
                label="Copy link"
                icon={copied ? Check : Copy}
                onClick={handleCopy}
              />
            </div>
          </Card>
        ) : (
          <EmptyState
            icon={LinkIcon}
            title="Select a phone number to generate a link"
          />
        )}
      </Card>

      {/* Recent links — persisted server-side; a copied link is saved here. */}
      <Card className="flex flex-col gap-3" padding="lg">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--st-text-muted)]" aria-hidden />
          <h2 className="u-card__title text-[14px] font-semibold">Recent links</h2>
        </div>

        {linksLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton height={40} className="w-full" />
            <Skeleton height={40} className="w-full" />
            <Skeleton height={40} className="w-full" />
          </div>
        ) : linksError ? (
          <Alert tone="danger" title="Couldn't load saved links">
            <p className="mb-2">{linksError}</p>
            <Button variant="outline" size="sm" onClick={() => void loadLinks()}>
              Retry
            </Button>
          </Alert>
        ) : savedLinks.length === 0 ? (
          <EmptyState
            icon={LinkIcon}
            title="No saved links yet"
            description="Generate a link and copy it — it will be saved here and on the link-tracking page."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {savedLinks.map((link) => (
              <li
                key={link._id}
                className="u-card u-card--outlined flex items-center gap-2 p-2"
              >
                <span className="flex-1 truncate font-mono text-[12px]" title={link.url}>
                  {link.url}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--st-text-muted)]">
                  {new Date(link.createdAt).toLocaleDateString()}
                </span>
                <IconButton
                  variant="outline"
                  size="sm"
                  label="Copy saved link"
                  icon={Copy}
                  onClick={() => {
                    void navigator.clipboard.writeText(link.url);
                    onSaved('Saved link copied to clipboard.');
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
