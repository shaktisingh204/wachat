import { Suspense } from 'react';
import { ZoruChatClient } from '../_components/zoru-chat-client';

/**
 * /wachat/chat - Live chat workspace.
 *
 * The 3-pane chat UI lives inside `ZoruChatClient` which manages its
 * own conversations list / thread / contact panel internally. The
 * client handles per-conversation badges (unread count, last-response
 * time, assigned agent avatar, last message preview, tags, intent
 * labels, SLA timer) inline. This route entry renders a Suspense
 * boundary with a wachat-ui shaped skeleton fallback that mirrors the
 * 3-pane composition while data loads.
 */

export const dynamic = 'force-dynamic';

function ChatPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-3 p-3">
      <div className="h-full w-[320px] shrink-0 animate-pulse rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded-full bg-zinc-100" />
          <div className="h-5 w-12 rounded-full bg-zinc-100" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <div className="h-6 w-14 rounded-full bg-zinc-100" />
          <div className="h-6 w-14 rounded-full bg-zinc-100" />
          <div className="h-6 w-14 rounded-full bg-zinc-100" />
        </div>
        <div className="mt-3 divide-y divide-zinc-100">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2">
              <div className="h-9 w-9 rounded-full bg-zinc-100" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 rounded-full bg-zinc-100" />
                  <div className="h-2.5 w-10 rounded-full bg-zinc-100" />
                </div>
                <div className="h-2.5 w-40 rounded-full bg-zinc-100" />
                <div className="flex gap-1.5">
                  <div className="h-3 w-10 rounded-full bg-zinc-100" />
                  <div className="h-3 w-12 rounded-full bg-zinc-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="h-full flex-1 animate-pulse rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-zinc-100" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 rounded-full bg-zinc-100" />
              <div className="h-2.5 w-20 rounded-full bg-zinc-100" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="h-6 w-16 rounded-full bg-zinc-100" />
            <div className="h-6 w-16 rounded-full bg-zinc-100" />
          </div>
        </div>
      </div>
      <div className="h-full w-[300px] shrink-0 animate-pulse rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="h-12 w-12 rounded-full bg-zinc-100" />
        <div className="mt-3 h-4 w-32 rounded-full bg-zinc-100" />
        <div className="mt-2 h-3 w-24 rounded-full bg-zinc-100" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <div className="h-full">
      <Suspense fallback={<ChatPageSkeleton />}>
        <ZoruChatClient />
      </Suspense>
    </div>
  );
}
