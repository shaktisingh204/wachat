const fs = require('fs');
const path = require('path');

const files = [
  "src/app/dashboard/telegram/mini-apps/page.tsx",
  "src/app/dashboard/telegram/page.tsx",
  "src/app/dashboard/telegram/payments/page.tsx",
  "src/app/dashboard/telegram/projects/page.tsx",
  "src/app/dashboard/telegram/settings/page.tsx",
  "src/app/dashboard/telegram/stickers/page.tsx",
  "src/app/dashboard/telegram/stories/page.tsx",
  "src/app/dashboard/telegram/webhooks/page.tsx",
  "src/app/dashboard/url-shortener/[id]/page.tsx",
  "src/app/dashboard/url-shortener/bio/page.tsx",
  "src/app/dashboard/url-shortener/collections/page.tsx",
  "src/app/dashboard/url-shortener/page.tsx",
  "src/app/dashboard/url-shortener/settings/page.tsx",
  "src/app/dashboard/url-shortener/settings/webhooks/page.tsx",
  "src/app/dashboard/user/billing/history/page.tsx",
  "src/app/dashboard/user/billing/page.tsx",
  "src/app/dashboard/user/page.tsx",
  "src/app/dashboard/user/profile/page.tsx",
  "src/app/dashboard/user/settings/page.tsx",
  "src/app/dashboard/user/settings/profile/page.tsx",
  "src/app/dashboard/user/settings/ui/page.tsx",
  "src/app/dashboard/wachat/contacts/page.tsx",
  "src/app/dashboard/wachat/page.tsx",
  "src/app/dashboard/wachat/setup/docs/page.tsx",
  "src/app/dashboard/wachat/setup/page.tsx",
  "src/app/dashboard/website-builder/manage/[portfolioId]/builder/page.tsx",
  "src/app/dashboard/website-builder/page.tsx",
  "src/app/dashboard/whatsapp/ads/page.tsx",
  "src/app/dl/[shortCode]/page.tsx",
  "src/app/embed/chat/[id]/page.tsx",
  "src/app/embed/crm-form/[formId]/page.tsx",
  "src/app/enterprise/page.tsx",
  "src/app/expired/page.tsx",
  "src/app/features/[slug]/page.tsx",
  "src/app/features/page.tsx",
  "src/app/flow/[flowId]/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/invite/[token]/page.tsx",
  "src/app/login/page.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/p/contract/[token]/page.tsx",
  "src/app/p/estimate/[token]/page.tsx",
  "src/app/p/gdpr/[leadEmail]/page.tsx",
  "src/app/p/invoice/[token]/page.tsx",
  "src/app/p/lead-form/[formId]/page.tsx"
];

for (const file of files) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    const isClient = content.includes("'use client'") || content.includes('"use client"');
    const hasDynamic = content.includes("export const dynamic = 'force-dynamic'");
    console.log(`${file} | Client: ${isClient} | Dynamic: ${hasDynamic}`);
  } else {
    console.log(`${file} | DOES NOT EXIST`);
  }
}
