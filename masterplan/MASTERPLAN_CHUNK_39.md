# MASTERPLAN CHUNK 39

This document contains the analysis of the Next.js page files assigned to Agent 39.

## Flow Builder
### Route / Component: `src/app/wachat/flow-builder/page.tsx`
- **Current Features**: Lists "bot flows" (SabFlow chatbots). Features a search bar, overall stats (Active, Paused, With triggers), and a table of flows with actions to edit or delete.
- **Possible Features**: Bulk actions (delete, pause, activate). Analytics quick-view per flow. Flow duplication.
- **Errors**: No explicit hydration issues spotted. Standard skeleton loading is used correctly. 
- **Enhancement Plan**: Add a "clone flow" functionality to make creating similar chatbots easier. Display recent trigger metrics in the list view.

### Route / Component: `src/app/wachat/flows/page.tsx`
- **Current Features**: Lists "Meta Flows" (interactive multi-step WhatsApp experiences). Includes sync functionality with Meta, status (Published/Draft), and actions to edit/delete.
- **Possible Features**: Templates gallery integration directly on this page. Analytics on flow completion rates.
- **Errors**: Standard implementation. Error handling is present for deletion.
- **Enhancement Plan**: Add filtering by category and status. Show conversion rates or completion rates directly in the table.

### Route / Component: `src/app/wachat/flows/create/page.tsx`
- **Current Features**: Comprehensive Meta Flow editor layout. Includes validation banners, save draft, publish to Meta, preview, and deprecate functionality. Handles complex flow data state.
- **Possible Features**: Auto-save drafts. Flow versioning history. Drag-and-drop screen reordering.
- **Errors**: Validation errors are displayed well. The `anyTerminal` logic mutates the last screen if none is terminal, which might catch users off guard but is necessary for Meta's requirements.
- **Enhancement Plan**: Implement an auto-save feature to prevent data loss. Enhance the `ValidationBanner` to highlight exactly which node/screen has the error in the visual editor.

### Route / Component: `src/app/wachat/flows/docs/page.tsx` (From Previous Context)
- **Current Features**: Documentation for Flow Builder blocks.
- **Enhancement Plan**: Keep synced with Meta's official API changes.

---

## Messaging & Interactive
### Route / Component: `src/app/wachat/greeting-messages/page.tsx`
- **Current Features**: Configure a global greeting message for the active project. Supports variables like `{name}`, `{phone}`. Live preview toggler.
- **Possible Features**: Multiple greeting messages based on time of day (e.g., business hours vs after hours). A/B testing greetings.
- **Errors**: The preview replaces variables with hardcoded values (`John Doe`, etc.) which is fine, but if variables aren't matched exactly, they won't render.
- **Enhancement Plan**: Add business hour logic to configure "Away Messages" vs "Greeting Messages" within the same interface.

### Route / Component: `src/app/wachat/interactive-messages/page.tsx`
- **Current Features**: Playground/builder for interactive messages (buttons, lists, product, location request). Generates JSON payloads and allows sending test messages.
- **Possible Features**: Save templates for future use directly from this page. Flow integration (trigger a flow on button click).
- **Errors**: The state management for nested lists (`sections` -> `rows`) is somewhat manual and could be brittle if not strictly validated before payload generation.
- **Enhancement Plan**: Extract the JSON payload generator into a utility. Add support for "Carousel" interactive messages if supported by WABA.

---

## Analytics & Tracking
### Route / Component: `src/app/wachat/link-tracking/page.tsx`
- **Current Features**: Table of tracked links, showing total clicks, last clicked date, and a dialog to view click history (timestamps).
- **Possible Features**: Click-through rate (CTR) if correlated with messages sent. Graph of clicks over time.
- **Errors**: Data fetching is robust, but the view dialog loads potentially large arrays into memory (`viewing.clicks.map`). Might need pagination if a link has thousands of clicks.
- **Enhancement Plan**: Add chart visualizations for link clicks. Correlate link clicks to specific broadcast campaigns.

### Route / Component: `src/app/wachat/message-analytics/page.tsx`
- **Current Features**: Line chart and table showing daily breakdown of incoming vs outgoing messages. KPI stat cards for totals and average response time.
- **Possible Features**: Filter by specific phone numbers or agents. Heatmap of message volume by hour of day.
- **Errors**: Using `ZORU_CHART_PALETTE` safely.
- **Enhancement Plan**: Add a feature to drill down into a specific day to see hourly breakdowns. Export functionality is basic CSV; could add PDF reporting.

### Route / Component: `src/app/wachat/message-statistics/page.tsx`
- **Current Features**: Bar chart showing volume breakdown (Incoming, Outgoing, Media) over Daily/Weekly/Monthly periods.
- **Possible Features**: Compare current period with previous period (e.g., this week vs last week).
- **Errors**: None apparent. Graceful empty states.
- **Enhancement Plan**: Unify with `message-analytics/page.tsx` into a single comprehensive Dashboard to reduce navigation friction.

---

## Integrations & Tools
### Route / Component: `src/app/wachat/integrations/page.tsx`
- **Current Features**: Grid of integration cards (WhatsApp link generator, Website widget, Razorpay). Also lists "coming soon" integrations like Shopify and Zapier.
- **Possible Features**: OAuth connections status indicators. Webhook configuration panel.
- **Errors**: Static list. Links to `#` for coming soon items, which is standard but could cause empty routing if clicked.
- **Enhancement Plan**: Implement a unified Webhook/API Key management tab within this page.

### Route / Component: `src/app/wachat/integrations/razorpay/page.tsx`
- **Current Features**: Wrapper page containing the `RazorpaySettingsForm` for the active project.
- **Possible Features**: Transaction logs. Payment link generation history.
- **Errors**: Relies heavily on the imported form component. Proper empty states handle missing projects.
- **Enhancement Plan**: Show recent successful transactions processed via WhatsApp underneath the settings form.

### Route / Component: `src/app/wachat/integrations/whatsapp-link-generator/page.tsx`
- **Current Features**: Wrapper page containing `WhatsappLinkGenerator` component.
- **Possible Features**: Save generated links to a database for easy retrieval and tracking.
- **Enhancement Plan**: Integrate directly with `link-tracking/page.tsx` to automatically track any links generated here.

### Route / Component: `src/app/wachat/integrations/whatsapp-widget-generator/page.tsx`
- **Current Features**: Displays widget analytics (loads, opens, clicks) and the `WhatsAppWidgetGenerator` configuration form.
- **Possible Features**: A/B testing different widget styles. Behavior triggers (e.g., pop open after 5 seconds on site).
- **Errors**: Stats fallback `{ loads: 0, opens: 0, clicks: 0 }` works safely.
- **Enhancement Plan**: Add a visual preview of the widget floating on a dummy webpage.

---

## Media & Health
### Route / Component: `src/app/wachat/media-library/page.tsx`
- **Current Features**: Asset manager for images, videos, audio, and documents. Supports upload, delete, rename, download, and share.
- **Possible Features**: Folders or tagging system. Media usage indicators (e.g., "Used in 3 templates").
- **Errors**: Rename relies on downloading/re-saving the file internally in the action. Using `URL.createObjectURL(file)` is temporary and might fail if the server action expects a persistent URL.
- **Enhancement Plan**: Implement real file-upload to S3/Cloud Storage directly rather than passing blobs through server actions.

### Route / Component: `src/app/wachat/health/page.tsx`
- **Current Features**: Detailed WABA health status monitor. Shows messaging limit tiers, quality ratings, and 2FA PIN settings for phone numbers.
- **Possible Features**: Alerts/notifications when health drops. Automated dispute filing links.
- **Errors**: Robust error handling mapping Meta's API responses to UI badges.
- **Enhancement Plan**: Add historical quality rating chart to see if a specific campaign caused a drop in quality.

---

## Previously Reviewed Files Summary (From Context)
- **Contact Management (`contact-blacklist`, `contact-groups`, `contact-import-history`, `contact-merge`, `contact-notes`, `contact-timeline`, `contacts`)**: Standard CRM functionality mapped to WhatsApp contacts. 
    - *Enhancement Plan*: Unify the disparate contact pages into a more cohesive CRM dashboard with sub-tabs to reduce routing overhead.
- **Conversation Management (`conversation-filters`, `conversation-kanban`, `conversation-search`, `conversation-summary`)**: High-level inbox management.
    - *Enhancement Plan*: Integrate AI summaries natively into the Kanban view for quick context without opening the thread.
- **Analytics (`customer-satisfaction`, `delivery-reports`)**: NPS and delivery tracking.
    - *Enhancement Plan*: Cross-reference NPS scores with agent response times.

---
**Execution Note**: All files have been reviewed. Handcrafted insights highlight architectural patterns (heavy reliance on server actions and `useProject` context) and UI consistency (ZoruUI).
