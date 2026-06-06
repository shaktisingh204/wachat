'use client';

/**
 * SabWriter editor surface.
 *
 * This is the collaborative editing screen for a single document. The
 * editor body itself is currently a TipTap-shaped placeholder — TipTap
 * is not yet a dependency, so we ship a `<Textarea>` while keeping the
 * data model (contentJson, anchors, presence, suggestions) fully wired.
 *
 * Wiring TODO:
 *   - `pnpm add @tiptap/react @tiptap/starter-kit @tiptap/pm` and swap the
 *     `<Textarea>` for an `EditorContent` mount.
 *   - Replace `MockTransport` with the Y.js + Hocuspocus wire transport
 *     once the websocket sidecar lands.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  History,
  MessageCircle,
  Save,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';

import { Avatar, AvatarFallback, Badge, Button, Card, CardBody, Input, Textarea } from '@/components/sabcrm/20ui';
import {
  getSabwriterDocument,
  updateSabwriterDocument,
  saveSabwriterVersion,
  listSabwriterComments,
  addSabwriterComment,
  resolveSabwriterComment,
  listSabwriterSuggestions,
  acceptSabwriterSuggestion,
  rejectSabwriterSuggestion,
  sendDocumentForSignature,
} from '@/app/actions/sabwriter.actions';
import type { SabwriterDocumentDoc } from '@/lib/rust-client/sabwriter-documents';
import type { SabwriterCommentDoc } from '@/lib/rust-client/sabwriter-comments';
import type { SabwriterSuggestionDoc } from '@/lib/rust-client/sabwriter-suggestions';
import type { SabwriterPresenceDoc } from '@/lib/rust-client/sabwriter-presence';
import {
  getDefaultTransport,
  type IWriterTransport,
} from '@/lib/sabwriter/transport';

/* ---------------------------------------------------------------- */
/* Helpers                                                            */
/* ---------------------------------------------------------------- */

/** Extract a plain-text editing surface from a TipTap JSON doc. */
function contentToText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const json = content as { content?: unknown[]; text?: string; type?: string };
  if (typeof json.text === 'string') return json.text;
  if (Array.isArray(json.content)) {
    return json.content
      .map((c) => contentToText(c))
      .filter(Boolean)
      .join(json.type === 'paragraph' ? '' : '\n');
  }
  return '';
}

/** Round-trip plain text back into a minimal TipTap doc. */
function textToContent(text: string): Record<string, unknown> {
  const paragraphs = text.split(/\n{2,}/);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: p ? [{ type: 'text', text: p }] : [],
    })),
  };
}

/* ---------------------------------------------------------------- */
/* Component                                                          */
/* ---------------------------------------------------------------- */

export default function SabwriterDocEditorPage() {
  const params = useParams<{ docId: string }>();
  const router = useRouter();
  const docId = params?.docId ?? '';

  const [doc, setDoc] = React.useState<SabwriterDocumentDoc | null>(null);
  const [title, setTitle] = React.useState('');
  const [editorText, setEditorText] = React.useState('');
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [comments, setComments] = React.useState<SabwriterCommentDoc[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<SabwriterSuggestionDoc[]>([]);
  const [presence, setPresence] = React.useState<SabwriterPresenceDoc[]>([]);
  const transportRef = React.useRef<IWriterTransport | null>(null);

  // Initial load.
  React.useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    void (async () => {
      const [d, c, s] = await Promise.all([
        getSabwriterDocument(docId),
        listSabwriterComments({ documentId: docId, status: 'all', limit: 100 }),
        listSabwriterSuggestions({ documentId: docId, status: 'pending', limit: 100 }),
      ]);
      if (cancelled) return;
      setDoc(d);
      setTitle(d.title);
      setEditorText(contentToText(d.contentJson));
      setComments(c.items);
      setSuggestions(s.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Transport / presence wiring.
  React.useEffect(() => {
    if (!docId) return;
    const t = getDefaultTransport();
    transportRef.current = t;
    const offPresence = t.subscribePresence(setPresence);
    void t.connect(docId, { color: '#7C5CFF' });
    return () => {
      offPresence();
      void t.disconnect();
      transportRef.current = null;
    };
  }, [docId]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const contentJson = textToContent(editorText);
      const next = await updateSabwriterDocument(doc._id, {
        title: title.trim() || 'Untitled document',
        contentJson,
      });
      setDoc(next);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!doc) return;
    // Persist the current draft first so the version snapshot reflects it.
    await handleSave();
    const note = window.prompt('Optional comment for this version:') || undefined;
    await saveSabwriterVersion(doc._id, note);
  };

  const handleAddComment = async () => {
    if (!doc || !newComment.trim()) return;
    await addSabwriterComment({
      documentId: doc._id,
      anchor: { from: 0, to: editorText.length },
      body: newComment.trim(),
    });
    setNewComment('');
    const refreshed = await listSabwriterComments({
      documentId: doc._id,
      status: 'all',
      limit: 100,
    });
    setComments(refreshed.items);
  };

  const handleResolveComment = async (id: string) => {
    await resolveSabwriterComment(id);
    setComments((prev) =>
      prev.map((c) => (c._id === id ? { ...c, resolved: true } : c)),
    );
  };

  const handleAcceptSuggestion = async (id: string) => {
    await acceptSabwriterSuggestion(id);
    setSuggestions((prev) => prev.filter((s) => s._id !== id));
  };

  const handleRejectSuggestion = async (id: string) => {
    await rejectSabwriterSuggestion(id);
    setSuggestions((prev) => prev.filter((s) => s._id !== id));
  };

  const handleSendForSignature = async () => {
    if (!doc) return;
    if (
      !confirm(
        'Send this document for signature? You will be redirected to the envelope builder.',
      )
    ) {
      return;
    }
    await handleSave();
    const { envelopeId } = await sendDocumentForSignature(doc._id, {
      name: title.trim() || doc.title,
      signers: [],
      fields: [],
    });
    if (envelopeId) {
      router.push(`/dashboard/sabsign/${envelopeId}`);
    } else {
      router.push('/dashboard/sabsign');
    }
  };

  if (!doc) {
    return (
      <div className="p-6 text-sm text-[var(--st-text-secondary)]">Loading document…</div>
    );
  }

  const openComments = comments.filter((c) => !c.resolved);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/sabsign/docs" aria-label="Back to documents">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className="border-0 shadow-none text-lg font-medium px-1 focus-visible:ring-0"
            aria-label="Document title"
          />
          <Badge variant="outline" className="capitalize">
            {doc.status.replace(/_/g, ' ')}
          </Badge>
          <span className="text-xs text-[var(--st-text-secondary)] whitespace-nowrap">
            v{doc.version ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Presence avatars */}
          <div className="flex -space-x-2">
            {presence.slice(0, 5).map((p) => (
              <Avatar
                key={p.userId}
                className="h-7 w-7 ring-2 ring-[var(--st-bg-secondary)]"
                style={{ background: p.color }}
                title={p.displayName ?? p.userId}
              >
                <AvatarFallback>
                  {(p.displayName ?? '?').slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {presence.length > 5 ? (
              <Badge variant="outline">+{presence.length - 5}</Badge>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/sabsign/docs/${doc._id}/history`}>
              <History className="h-4 w-4 mr-2" />
              History
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveVersion}>
            <Save className="h-4 w-4 mr-2" />
            Save version
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button size="sm" onClick={handleSendForSignature}>
            <Send className="h-4 w-4 mr-2" />
            Send for signature
          </Button>
        </div>
      </div>

      {/* Main editor + side panels */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="overflow-auto p-6">
          {/*
            TipTap-based editor surface (placeholder).
            Wiring TODO: install `@tiptap/react` + `@tiptap/starter-kit`
            and swap this <Textarea> for `<EditorContent editor={...} />`.
          */}
          <Textarea
            value={editorText}
            onChange={(e) => {
              setEditorText(e.target.value);
              setDirty(true);
            }}
            className="min-h-[60vh] font-sans text-base leading-relaxed"
            placeholder="Start writing…"
            aria-label="Document body"
          />
        </div>

        <aside className="border-l border-[var(--st-border)] overflow-auto">
          {/* Suggestions panel */}
          <section className="p-4 border-b border-[var(--st-border)]">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--st-text)] inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Suggestions
              </h3>
              <Badge variant="outline">{suggestions.length}</Badge>
            </header>
            {suggestions.length === 0 ? (
              <p className="text-xs text-[var(--st-text-secondary)]">
                No pending suggestions.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <li key={s._id} className="rounded-lg border border-[var(--st-border)] p-2">
                    <p className="text-xs text-[var(--st-text-secondary)] mb-2">
                      Range {s.anchor.from}–{s.anchor.to}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptSuggestion(s._id)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectSuggestion(s._id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Comments panel */}
          <section className="p-4">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--st-text)] inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4" /> Comments
              </h3>
              <Badge variant="outline">{openComments.length}</Badge>
            </header>
            <div className="flex flex-col gap-2 mb-3">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Leave a comment…"
                rows={2}
              />
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                Add comment
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {comments.map((c) => (
                <li
                  key={c._id}
                  className={`rounded-lg border border-[var(--st-border)] p-2 ${
                    c.resolved ? 'opacity-60' : ''
                  }`}
                >
                  <Link
                    href={`/dashboard/sabsign/docs/${doc._id}/comments/${c._id}`}
                    className="block"
                  >
                    <p className="text-sm text-[var(--st-text)] line-clamp-3">
                      {c.body}
                    </p>
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                    {!c.resolved ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResolveComment(c._id)}
                      >
                        Resolve
                      </Button>
                    ) : (
                      <Badge variant="outline">Resolved</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
