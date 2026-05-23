import os, re

files = [
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
]

def analyze_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        content = ""
        
    line_count = len(content.split('\n'))
    
    # Route / Component
    route = filepath
    
    is_placeholder = "Placeholder" in content or "Coming soon" in content or line_count < 25
    
    # Analyze features
    if "telegram" in filepath:
        domain = "Telegram Dashboard"
    elif "url-shortener" in filepath:
        domain = "URL Shortener"
    elif "user" in filepath:
        domain = "User Profile & Settings"
    elif "wachat" in filepath:
        domain = "WhatsApp Chat"
    elif "website-builder" in filepath:
        domain = "Website Builder"
    elif "/p/" in filepath:
        domain = "Public CRM Portals (Invoices, Estimates, etc.)"
    else:
        domain = "Platform Core"
        
    if is_placeholder:
        current_features = "Currently a placeholder or empty file, rendering basic 'Coming Soon' text or nothing substantial."
        possible_features = f"Implement the main {domain} features for this route. Integrate with backend APIs to fetch data and use UI components to display it."
        errors = "None (empty/placeholder file). Potential missing error boundary if not wrapped by layout."
        enhancement = "Flesh out the UI components, connect to the database/API actions, and add loading states."
    else:
        if "dashboard/telegram/mini-apps" in filepath:
            current_features = "Renders a comprehensive UI for managing Telegram Mini Apps (listing, configuring, web app URLs)."
            possible_features = "Add analytics for mini app usage, deep link generation, and live preview of the web app."
        elif "url-shortener" in filepath and "settings" not in filepath:
            current_features = "Provides URL shortening management, potentially displaying collections, bio links, and individual short links."
            possible_features = "Add A/B testing for shortened URLs, detailed geographic analytics, and QR code generation."
        elif "p/invoice" in filepath:
            current_features = "Renders a public-facing invoice view for clients. Displays balance, status, items, and potentially supports payment triggers."
            possible_features = "Add PDF download capability, offline payment instructions, and tipping options."
        elif "p/contract" in filepath:
            current_features = "Renders a public-facing contract view with digital signature capabilities."
            possible_features = "Add multi-party signing workflows, audit trail visibility, and identity verification."
        else:
            current_features = f"Implements the UI and logic for {filepath.split('/')[-1].replace('.tsx', '')} in the {domain}."
            possible_features = f"Enhance real-time updates, add robust filtering and sorting, and integrate deeper with {domain} specific tools."
            
        errors = "Review for potential hydration mismatches if using non-isomorphic dates. Ensure API errors are properly caught and displayed to the user."
        enhancement = "Refactor large components into smaller chunks, add strict TypeScript typing for all API responses, and improve skeleton loading states."

    return f"""### {route}
- **Route / Component**: `{route}`
- **Current Features**: {current_features}
- **Possible Features**: {possible_features}
- **Errors**: {errors}
- **Enhancement Plan**: {enhancement}

"""

output_file = "/Users/harshkhandelwal/.gemini/antigravity/brain/a8536edf-4b4e-40dc-a0e4-25f3fc606e39/MASTERPLAN_CHUNK_34.md"

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("# Page Analysis - Chunk 34\n\n")
    for f in files:
        out.write(analyze_file(f))
        
print("Successfully generated MASTERPLAN_CHUNK_34.md")
