'use client';

/**
 * Meta-style ad preview renderer. Mirrors the 14+ placements that
 * Meta Ads Manager shows in its right-side preview pane: Facebook
 * Feed, Mobile Feed, Story, Reels, Marketplace, Right Column,
 * Instagram Feed, Story, Reels, Explore, Shop, Messenger Inbox,
 * Messenger Story, and Audience Network.
 *
 * Everything renders client-side from the current form state so
 * the previews update live as the user edits without needing a
 * real ad ID. When the ad is actually created, Meta's own
 * `generatepreviews` endpoint is also available via
 * `getAllAdPreviews` for pixel-perfect iframe previews.
 */

import * as React from 'react';
import {
    Heart, MessageCircle, Send, Bookmark, MoreHorizontal,
    ThumbsUp, Share2, Facebook, Instagram, MessageSquare, Globe,
    ChevronLeft, ChevronRight, Music2, Play, Volume2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { FacebookPage } from '@/lib/definitions';
import { PREVIEW_VARIANTS, type AdPreviewFormat } from '@/components/wabasimplify/ad-manager/constants';
import type { CreateFormState } from './form-state';

/* ── Shared helpers ────────────────────────────────────────────── */

type PreviewProps = {
    state: CreateFormState;
    page?: FacebookPage;
    ig?: { username?: string; profile_picture_url?: string };
};

function pageInitials(name?: string) {
    return (name || 'AD').slice(0, 2).toUpperCase();
}

function PrimaryImage({ state, className }: { state: CreateFormState; className?: string }) {
    if (state.imageUrl) {
        return <img src={state.imageUrl} alt="" className={cn('w-full h-full object-cover', className)} />;
    }
    return (
        <div className={cn('w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs text-slate-500', className)}>
            Image placeholder
        </div>
    );
}

function CtaButton({ state }: { state: CreateFormState }) {
    return (
        <button type="button" className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold px-3 py-1.5 rounded-md">
            {state.callToAction.replace(/_/g, ' ')}
        </button>
    );
}

/* ── Facebook Desktop Feed ─────────────────────────────────────── */

function FacebookDesktopFeed({ state, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[280px] bg-white text-[13px] text-slate-900 border rounded-lg overflow-hidden shadow-sm font-sans">
            <div className="flex items-center gap-2 p-3">
                <div className="h-10 w-10 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center font-bold text-sm">
                    {pageInitials(page?.name)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] truncate">{page?.name || 'Your Page'}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        Sponsored · <Globe className="h-3 w-3" />
                    </div>
                </div>
                <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </div>
            <div className="px-3 pb-2 text-[13px] whitespace-pre-wrap line-clamp-3">
                {state.primaryTexts[0] || 'Your ad copy will appear here.'}
            </div>
            <div className="aspect-[1.91/1] bg-slate-100">
                <PrimaryImage state={state} />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 border-t">
                <div className="min-w-0 flex-1 pr-2">
                    <div className="text-[10px] text-slate-500 uppercase truncate">
                        {state.displayLink || extractDomain(state.destinationUrl)}
                    </div>
                    <div className="font-semibold text-[14px] truncate">{state.headlines[0] || 'Headline'}</div>
                    <div className="text-[11px] text-slate-500 truncate">{state.descriptions[0] || 'Description'}</div>
                </div>
                <CtaButton state={state} />
            </div>
            <div className="flex items-center justify-around p-1 border-t text-slate-500">
                <button type="button" className="flex items-center gap-1 text-[12px] px-3 py-1 hover:bg-slate-50 rounded flex-1 justify-center">
                    <ThumbsUp className="h-4 w-4" /> Like
                </button>
                <button type="button" className="flex items-center gap-1 text-[12px] px-3 py-1 hover:bg-slate-50 rounded flex-1 justify-center">
                    <MessageCircle className="h-4 w-4" /> Comment
                </button>
                <button type="button" className="flex items-center gap-1 text-[12px] px-3 py-1 hover:bg-slate-50 rounded flex-1 justify-center">
                    <Share2 className="h-4 w-4" /> Share
                </button>
            </div>
        </div>
    );
}

/* ── Facebook Mobile Feed ──────────────────────────────────────── */

function FacebookMobileFeed({ state, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[280px] bg-white text-[13px] text-slate-900 rounded-[32px] overflow-hidden border-4 border-slate-900 shadow-xl font-sans">
            <div className="bg-white px-4 py-2 flex items-center justify-between text-[10px] font-semibold">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1.5 bg-slate-900 rounded-sm" />
                    <div className="w-3 h-1.5 bg-slate-900 rounded-sm" />
                </div>
            </div>
            <div className="bg-[#1877F2] text-white px-3 py-2 text-sm font-bold">facebook</div>
            <div className="p-3 flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center font-bold text-xs">
                    {pageInitials(page?.name)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[12px] truncate">{page?.name || 'Your Page'}</div>
                    <div className="text-[10px] text-slate-500">Sponsored</div>
                </div>
            </div>
            <div className="px-3 pb-2 text-[12px] line-clamp-3">
                {state.primaryTexts[0] || 'Your ad copy will appear here.'}
            </div>
            <div className="aspect-square bg-slate-100"><PrimaryImage state={state} /></div>
            <div className="p-3 bg-slate-50 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                    <div className="text-[9px] text-slate-500 uppercase truncate">
                        {state.displayLink || extractDomain(state.destinationUrl)}
                    </div>
                    <div className="font-semibold text-[12px] truncate">{state.headlines[0] || 'Headline'}</div>
                </div>
                <CtaButton state={state} />
            </div>
        </div>
    );
}

/* ── Facebook / IG Story & Reels (vertical 9:16) ───────────────── */

function VerticalStory({ state, page, ig, variant }: PreviewProps & { variant: 'fb-story' | 'ig-story' | 'fb-reels' | 'ig-reels' | 'msg-story' }) {
    const bg = variant === 'ig-story' || variant === 'ig-reels' ? 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400' : 'bg-slate-900';
    const isReels = variant === 'fb-reels' || variant === 'ig-reels';
    const handle = variant.startsWith('ig-') ? `@${ig?.username || 'yourhandle'}` : page?.name || 'Your Page';
    return (
        <div className={cn('w-full max-w-[240px] aspect-[9/16] rounded-[32px] overflow-hidden border-4 border-slate-900 shadow-xl relative font-sans', bg)}>
            {state.imageUrl && (
                <img src={state.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
            <div className="absolute top-3 left-3 right-3 flex items-center gap-2 text-white">
                <div className="h-7 w-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-[10px] font-bold">
                    {pageInitials(page?.name)}
                </div>
                <div className="text-[11px] font-semibold flex-1 truncate">{handle}</div>
                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">Sponsored</span>
                <MoreHorizontal className="h-4 w-4" />
            </div>
            <div className="absolute top-12 left-3 right-3 h-0.5 bg-white/30 rounded-full">
                <div className="h-full w-1/3 bg-white rounded-full" />
            </div>

            {isReels && (
                <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4 text-white">
                    <Heart className="h-6 w-6 fill-white/20" />
                    <MessageCircle className="h-6 w-6" />
                    <Send className="h-6 w-6" />
                    <Bookmark className="h-6 w-6" />
                </div>
            )}

            <div className="absolute bottom-14 left-3 right-3 text-white space-y-1">
                <div className="text-[11px] line-clamp-3 drop-shadow">
                    {state.primaryTexts[0] || 'Your ad copy will appear here.'}
                </div>
                {isReels && (
                    <div className="text-[10px] flex items-center gap-1 opacity-80">
                        <Music2 className="h-3 w-3" /> Original audio
                    </div>
                )}
            </div>

            <div className="absolute bottom-3 left-3 right-3">
                <button className="w-full bg-white text-slate-900 text-xs font-semibold py-2 rounded-full">
                    {state.callToAction.replace(/_/g, ' ')}
                </button>
            </div>
        </div>
    );
}

/* ── Instagram Feed ────────────────────────────────────────────── */

function InstagramFeed({ state, ig, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[280px] bg-white text-[13px] text-slate-900 rounded-[32px] overflow-hidden border-4 border-slate-900 shadow-xl font-sans">
            <div className="bg-white px-3 py-2 flex items-center justify-between">
                <Instagram className="h-5 w-5" />
                <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5" />
                    <MessageCircle className="h-5 w-5" />
                </div>
            </div>
            <div className="p-2.5 flex items-center gap-2 border-t">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400 p-0.5">
                    <div className="bg-white rounded-full h-full w-full flex items-center justify-center text-[9px] font-bold">
                        {pageInitials(page?.name)}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[12px] truncate">
                        {ig?.username || page?.name || 'yourhandle'}
                    </div>
                    <div className="text-[10px] text-slate-500">Sponsored</div>
                </div>
                <MoreHorizontal className="h-4 w-4" />
            </div>
            <div className="aspect-square bg-slate-100"><PrimaryImage state={state} /></div>
            <div className="p-2.5 flex items-center justify-between border-t">
                <div className="flex items-center gap-3">
                    <Heart className="h-5 w-5" />
                    <MessageCircle className="h-5 w-5" />
                    <Send className="h-5 w-5" />
                </div>
                <Bookmark className="h-5 w-5" />
            </div>
            <div className="px-2.5 pb-2 text-[12px]">
                <span className="font-semibold">{ig?.username || 'yourhandle'}</span>{' '}
                <span className="line-clamp-2 inline">
                    {state.primaryTexts[0] || 'Your ad copy will appear here.'}
                </span>
            </div>
            <div className="px-2.5 pb-2.5">
                <button className="w-full border text-[11px] font-semibold py-1.5 rounded">
                    {state.callToAction.replace(/_/g, ' ')}
                </button>
            </div>
        </div>
    );
}

/* ── Instagram Explore / Shop grid tile ────────────────────────── */

function InstagramGrid({ state, page, ig, label }: PreviewProps & { label: string }) {
    return (
        <div className="w-full max-w-[280px] rounded-[32px] overflow-hidden border-4 border-slate-900 shadow-xl font-sans bg-white">
            <div className="bg-white px-3 py-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{label}</div>
                <Instagram className="h-5 w-5" />
            </div>
            <div className="grid grid-cols-3 gap-px bg-slate-100 border-t">
                {Array.from({ length: 9 }).map((_, i) => {
                    const isAd = i === 4;
                    return (
                        <div key={i} className="aspect-square bg-slate-200 relative">
                            {isAd ? (
                                <>
                                    <PrimaryImage state={state} />
                                    <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[8px] px-1 py-0.5 rounded">
                                        Sponsored
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Marketplace Mobile ────────────────────────────────────────── */

function FacebookMarketplace({ state, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[280px] bg-white rounded-[32px] overflow-hidden border-4 border-slate-900 shadow-xl font-sans">
            <div className="bg-[#1877F2] text-white px-3 py-2 text-sm font-bold flex items-center gap-2">
                <Facebook className="h-4 w-4" /> Marketplace
            </div>
            <div className="p-3 space-y-2">
                <div className="rounded-lg overflow-hidden border">
                    <div className="aspect-square bg-slate-100"><PrimaryImage state={state} /></div>
                    <div className="p-2">
                        <div className="text-[10px] text-slate-500">Sponsored · {page?.name || 'Your Page'}</div>
                        <div className="text-[12px] font-semibold truncate">{state.headlines[0] || 'Headline'}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-2">
                            {state.primaryTexts[0] || 'Your ad copy will appear here.'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Facebook Right Column ─────────────────────────────────────── */

function FacebookRightColumn({ state, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[240px] bg-white border rounded-lg overflow-hidden shadow-sm font-sans text-[12px]">
            <div className="p-2 text-[10px] text-slate-500 border-b">Sponsored</div>
            <div className="flex gap-2 p-2">
                <div className="w-16 h-16 rounded overflow-hidden shrink-0 bg-slate-100">
                    <PrimaryImage state={state} />
                </div>
                <div className="min-w-0">
                    <div className="font-semibold line-clamp-2 text-[11px]">{state.headlines[0] || 'Headline'}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                        {state.displayLink || extractDomain(state.destinationUrl)}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Messenger Inbox ───────────────────────────────────────────── */

function MessengerInbox({ state, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[280px] bg-white rounded-[32px] overflow-hidden border-4 border-slate-900 shadow-xl font-sans">
            <div className="px-3 py-2 flex items-center gap-2 border-b">
                <MessageSquare className="h-5 w-5 text-[#1877F2]" />
                <span className="text-sm font-bold">Chats</span>
            </div>
            <div className="space-y-1">
                {['Mom', 'Work group'].map((c) => (
                    <div key={c} className="flex items-center gap-2 p-2">
                        <div className="h-9 w-9 rounded-full bg-slate-200" />
                        <div className="flex-1 text-[12px] font-semibold">{c}</div>
                    </div>
                ))}
                <div className="flex gap-2 p-2 bg-amber-50 border-y border-amber-200">
                    <div className="h-9 w-9 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        <PrimaryImage state={state} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate">{page?.name || 'Your Page'}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                            {state.primaryTexts[0] || 'Your ad copy will appear here.'}
                        </div>
                        <div className="text-[9px] text-amber-700 mt-0.5">Sponsored</div>
                    </div>
                </div>
                {['Alex', 'Sam', 'Chris'].map((c) => (
                    <div key={c} className="flex items-center gap-2 p-2">
                        <div className="h-9 w-9 rounded-full bg-slate-200" />
                        <div className="flex-1 text-[12px] font-semibold">{c}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Audience Network ──────────────────────────────────────────── */

function AudienceNetwork({ state, page }: PreviewProps) {
    return (
        <div className="w-full max-w-[280px] bg-white rounded-lg overflow-hidden shadow-sm border font-sans">
            <div className="p-2 text-[10px] text-slate-500 border-b flex items-center justify-between">
                <span>Inside a partner app</span>
                <Globe className="h-3 w-3" />
            </div>
            <div className="aspect-[1.91/1] bg-slate-100"><PrimaryImage state={state} /></div>
            <div className="p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-[10px] text-slate-500 truncate">
                        {state.displayLink || extractDomain(state.destinationUrl)}
                    </div>
                    <div className="text-[12px] font-semibold truncate">{state.headlines[0] || 'Headline'}</div>
                </div>
                <CtaButton state={state} />
            </div>
            <div className="px-2 pb-1 text-[9px] text-slate-400">Ad · {page?.name || 'Your Page'}</div>
        </div>
    );
}

/* ── Helpers ───────────────────────────────────────────────────── */

function extractDomain(url: string): string {
    if (!url) return 'your-site.com';
    try {
        return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
    } catch {
        return url;
    }
}

/* ── Main switcher ────────────────────────────────────────────── */

function renderVariant(
    id: AdPreviewFormat,
    props: PreviewProps,
): React.ReactNode {
    switch (id) {
        case 'DESKTOP_FEED_STANDARD':
            return <FacebookDesktopFeed {...props} />;
        case 'MOBILE_FEED_STANDARD':
            return <FacebookMobileFeed {...props} />;
        case 'FACEBOOK_STORY_MOBILE':
            return <VerticalStory {...props} variant="fb-story" />;
        case 'FACEBOOK_REELS_MOBILE':
            return <VerticalStory {...props} variant="fb-reels" />;
        case 'MARKETPLACE_MOBILE':
            return <FacebookMarketplace {...props} />;
        case 'RIGHT_COLUMN_STANDARD':
            return <FacebookRightColumn {...props} />;
        case 'INSTAGRAM_STANDARD':
            return <InstagramFeed {...props} />;
        case 'INSTAGRAM_STORY':
            return <VerticalStory {...props} variant="ig-story" />;
        case 'INSTAGRAM_REELS':
            return <VerticalStory {...props} variant="ig-reels" />;
        case 'INSTAGRAM_EXPLORE_CONTEXTUAL':
            return <InstagramGrid {...props} label="Explore" />;
        case 'INSTAGRAM_SHOP':
            return <InstagramGrid {...props} label="Shop" />;
        case 'MESSENGER_MOBILE_INBOX_MEDIA':
            return <MessengerInbox {...props} />;
        case 'MESSENGER_MOBILE_STORY_MEDIA':
            return <VerticalStory {...props} variant="msg-story" />;
        case 'AUDIENCE_NETWORK_OUTSTREAM_VIDEO':
            return <AudienceNetwork {...props} />;
        default:
            return null;
    }
}

export function AdPreviewSwitcher({
    state,
    pages,
    igAccounts,
}: {
    state: CreateFormState;
    pages: FacebookPage[];
    igAccounts: Array<{ id: string; username?: string; profile_picture_url?: string }>;
}) {
    const page = pages.find((p) => p.id === state.facebookPageId);
    const ig = igAccounts.find((i) => i.id === state.instagramActorId) || igAccounts[0];
    const props: PreviewProps = { state, page, ig };

    const [activeId, setActiveId] = React.useState<AdPreviewFormat>('DESKTOP_FEED_STANDARD');
    const activeVariant = PREVIEW_VARIANTS.find((v) => v.id === activeId) ?? PREVIEW_VARIANTS[0];

    const currentIdx = PREVIEW_VARIANTS.findIndex((v) => v.id === activeId);
    const prev = () => setActiveId(PREVIEW_VARIANTS[(currentIdx - 1 + PREVIEW_VARIANTS.length) % PREVIEW_VARIANTS.length].id);
    const next = () => setActiveId(PREVIEW_VARIANTS[(currentIdx + 1) % PREVIEW_VARIANTS.length].id);

    const byPlatform = React.useMemo(() => {
        const groups: Record<string, typeof PREVIEW_VARIANTS> = {
            facebook: [],
            instagram: [],
            messenger: [],
            audience_network: [],
        };
        for (const v of PREVIEW_VARIANTS) groups[v.platform].push(v);
        return groups;
    }, []);

    return (
        <div className="space-y-3">
            {/* Channel pills */}
            <ScrollArea className="w-full">
                <div className="flex gap-1 pb-2 min-w-max">
                    {Object.entries(byPlatform).map(([platform, variants]) => {
                        if (variants.length === 0) return null;
                        const PlatformIcon =
                            platform === 'facebook' ? Facebook :
                            platform === 'instagram' ? Instagram :
                            platform === 'messenger' ? MessageSquare : Globe;
                        return (
                            <div key={platform} className="flex items-center gap-1 pr-2 border-r last:border-0">
                                <PlatformIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                                {variants.map((v) => {
                                    const active = v.id === activeId;
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setActiveId(v.id)}
                                            className={cn(
                                                'text-[10px] px-2 py-1 rounded-full whitespace-nowrap transition-colors',
                                                active
                                                    ? 'bg-[#1877F2] text-white font-semibold'
                                                    : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                                            )}
                                        >
                                            {v.channel}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Active variant */}
            <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">
                    {currentIdx + 1} / {PREVIEW_VARIANTS.length}
                </Badge>
                <div className="text-xs font-medium">{activeVariant.label}</div>
                <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={prev}>
                        <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-6 w-6" onClick={next}>
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-center py-4 px-2 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl min-h-[360px]">
                <div className="w-full flex items-center justify-center">
                    {renderVariant(activeId, props)}
                </div>
            </div>
        </div>
    );
}
