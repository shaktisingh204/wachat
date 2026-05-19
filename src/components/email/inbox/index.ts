/**
 * Email Suite — Inbox UI.
 *
 * Three-pane shell composed of:
 *  - `FilterRail`        — quick filters + label rail (left).
 *  - `ConversationList`  — paginated thread list (middle).
 *  - `ThreadView`        — header + messages + composer (right).
 *
 * Mount via `<EmailInboxClient />` inside an `EmailSuiteLayout` page.
 */
export { EmailInboxClient } from './inbox-client';
export { FilterRail, type InboxQuickFilter, type FilterRailProps } from './filter-rail';
export { ConversationList, type ConversationListProps } from './conversation-list';
export { ThreadView, type ThreadViewProps } from './thread-view';
export { ReplyComposer, type ReplyComposerProps } from './reply-composer';
