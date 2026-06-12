
/** @type {import('next').NextConfig} */
const webpack = require('webpack');
require('dotenv').config();

const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

const nextConfig = {

  // `output: 'standalone'` was removed — PM2 (ecosystem.config.js)
  // runs `next start`, not the standalone server. With 9k+ API routes
  // the standalone NFT-trace ran `check-page` × 10,800 every build,
  // emitting GBs of `.nft.json` artifacts that were never read.
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
      // The macOS-style desktop hosts open apps in same-origin chromeless
      // iframes; Server Actions fired from inside a frame (or via the reverse
      // proxy) carry the proxied host as Origin. Whitelist the hosts the app is
      // served from so those action POSTs aren't rejected as cross-origin.
      allowedOrigins: [
        'sabnode.com',
        'www.sabnode.com',
        '15.235.234.217',
        'localhost:3000',
        'localhost:3002',
      ],
    },
    // Cap the static-page-collection worker pool. Default is
    // `os.cpus().length - 1`, which on the 32-core build host means
    // up to 31 worker processes during "Collecting page data". Each
    // worker can hold a multi-GB Node heap, and with 9k+ API routes to
    // chew through the peak working set easily passes the box's
    // 125 GB RAM + 32 GB swap and triggers the OOM-killer. Cap to 8
    // workers (peak ~32 GB) — slower wall-clock for this phase, but
    // it actually completes.
    cpus: 28,
    workerThreads: false,
  },
  // Heavy CJS packages that ship Node-only requires (`fs`, `dgram`, native
  // bindings, optional deps). Listed here so Next treats them as runtime
  // externals on the server side rather than trying to bundle them.
  serverExternalPackages: [
    'genkit',
    '@genkit-ai/core',
    '@genkit-ai/ai',
    '@genkit-ai/googleai',
    'mongodb',
    'mongoose',
    'jaeger-client',
    'thriftrw',
    '@opentelemetry/exporter-jaeger',
    '@opentelemetry/sdk-node',
    '@opentelemetry/instrumentation',
    'express',
    'send',
    // Google APIs chain (uses Node-only modules: net, tls, fs, child_process).
    'googleapis',
    'google-auth-library',
    'gcp-metadata',
    'gaxios',
    'https-proxy-agent',
    'agent-base',
    // MQTT / socks chain (sabflow MQTT block transitively pulls these and
    // they require Node `net`/`tls`).
    'mqtt',
    'socks',
    // node-fetch (transitive from googleapis) requires `node:fs`.
    'node-fetch',
    'fetch-blob',
    // nodemailer transport (used by email-service) requires Node TLS.
    'nodemailer',
    // Headless browser — native bindings, must never be bundled.
    'puppeteer',
    // IMAP / mail parsing
    'imapflow',
    'mailparser',
    // Queues / brokers / messaging
    'kafkajs',
    'amqplib',
    'rhea',
    'bullmq',
    // Redis clients
    'ioredis',
    'redis',
    // SQL drivers
    'pg',
    'mysql2',
    // Directory / file transfer
    'ldapjs',
    'ssh2-sftp-client',
    'basic-ftp',
    // PDF / Excel server-side codecs
    'pdf-parse',
    'exceljs',
    'jspdf',
    'jspdf-autotable',
    // Image native bindings
    'sharp',
    // Firebase admin (Node-only)
    'firebase-admin',
    // Payment / telephony SDKs
    'twilio',
    'stripe',
    'razorpay',
    // AWS SDK v3 chain used by sabfiles / R2
    '@aws-sdk/client-s3',
    '@aws-sdk/client-lambda',
    '@aws-sdk/s3-request-presigner',
    // Azure auth
    '@azure/msal-node',
    // GitHub REST SDK
    '@octokit/rest',
  ],
  // n8n workflow packages publish raw TS via the `import` export
  // condition (`./src/index.ts`) with a compiled `dist/index.js` only on
  // the `require` side. Turbopack/Next picks the ESM path and can't
  // parse a `.ts` file inside node_modules — list these here so Next
  // transpiles them as part of the build.
  transpilePackages: [
    '@n8n/tournament',
    '@n8n/expression-runtime',
  ],
  turbopack: {},

  // The dev server runs behind a reverse proxy on the public domain, so
  // requests for /_next/* dev resources (CSS/JS chunks, the webpack-hmr
  // WebSocket) arrive with the sabnode.com origin. Next 16 blocks
  // cross-origin dev resources by default — without whitelisting these the
  // page loads unstyled and non-interactive (chunks + HMR are refused).
  allowedDevOrigins: ['sabnode.com', 'www.sabnode.com', '15.235.234.217'],

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'wawachat.s3.us-east-1.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.whatsapp.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.fbcdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'scontent.*.fbcdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lookaside.fbsbx.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lookaside.whatsapp.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static5.lenskart.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.sabnode.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-76bc986b137b4ea49e6d08aad5b37200.r2.dev',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Wachat was relocated from `/dashboard/*` to `/wachat/*`. These
  // permanent (308) redirects keep every old bookmark, deep-link, and
  // shared URL working — `/dashboard/broadcasts/abc` lands on
  // `/wachat/broadcasts/abc`. Only routes that ARE wachat are listed;
  // sibling modules that stayed under `/dashboard` (sabflow, crm, seo,
  // hrm, ad-manager, email, sms, telegram, instagram, sabchat, …) are
  // intentionally absent from this map and continue to serve normally.
  async redirects() {
    const wachatRoutes = [
      'agent-availability', 'assignments', 'auto-reply', 'auto-reply-rules',
      'automation', 'away-messages', 'blocked-contacts', 'broadcast-history',
      'broadcast-scheduler', 'broadcast-segments', 'broadcasts', 'bulk',
      'bulk-messaging', 'business-hours', 'calls', 'campaign-ab-test',
      'canned-messages', 'chat', 'chat-export', 'chat-labels', 'chat-ratings',
      'chat-transfer', 'chatbot', 'contact-blacklist', 'contact-groups',
      'contact-import-history', 'contact-merge', 'contact-notes',
      'contact-timeline', 'contacts', 'conversation-filters',
      'conversation-kanban', 'conversation-search', 'conversation-summary',
      'customer-satisfaction', 'delivery-reports', 'greeting-messages',
      'interactive-messages', 'link-tracking', 'media-library',
      'message-analytics', 'message-statistics', 'message-tags',
      'message-templates-library', 'numbers', 'opt-out',
      'phone-number-settings', 'post-generator', 'qr-codes',
      'quick-reply-categories', 'response-time-tracker', 'saved-replies',
      'scheduled-messages', 'team-performance', 'template-analytics',
      'template-builder', 'templates', 'two-line', 'webhook-logs',
      'webhooks', 'whatsapp-ads', 'whatsapp-link-generator', 'whatsapp-pay',
    ];

    return [
      // /home was renamed to /dashboard (the SabNode account overview).
      // Keep the old URL alive for any inbound bookmarks.
      { source: '/home', destination: '/dashboard', permanent: true },

      // SabCRM settings were relocated into the SabNode settings hub
      // (`/dashboard/settings/crm`). Keep every old `/sabcrm/settings`
      // bookmark and deep-link alive.
      {
        source: '/sabcrm/settings',
        destination: '/dashboard/settings/crm',
        permanent: true,
      },
      {
        source: '/sabcrm/settings/:path*',
        destination: '/dashboard/settings/crm/:path*',
        permanent: true,
      },

      // The SabCRM "Opportunities" object was renamed to "Leads"
      // (slug opportunities → leads). Keep old record links alive.
      {
        source: '/sabcrm/opportunities',
        destination: '/sabcrm/leads',
        permanent: true,
      },
      {
        source: '/sabcrm/opportunities/:path*',
        destination: '/sabcrm/leads/:path*',
        permanent: true,
      },

      // Each wachat subroute and its descendants. Each wachat directory
      // moved out of /dashboard into /wachat — old bookmarks like
      // `/dashboard/broadcasts/abc` redirect to `/wachat/broadcasts/abc`.
      // The bare-`/dashboard` rule that previously redirected to
      // /wachat is intentionally GONE — `/dashboard` is now its own
      // page (the account overview, formerly `/home`).
      ...wachatRoutes.flatMap((route) => [
        {
          source: `/dashboard/${route}`,
          destination: `/wachat/${route}`,
          permanent: true,
        },
        {
          source: `/dashboard/${route}/:path*`,
          destination: `/wachat/${route}/:path*`,
          permanent: true,
        },
      ]),
      // Legacy CRM HR to HRM redirects
      {
        source: '/dashboard/crm/hr/:path*',
        destination: '/dashboard/hrm/hr/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/crm/hr-payroll/:path*',
        destination: '/dashboard/hrm/payroll/:path*',
        permanent: true,
      },
      // Redirect meta-suite to facebook
      {
        source: '/dashboard/meta-suite',
        destination: '/dashboard/facebook',
        permanent: true,
      },
      {
        source: '/dashboard/meta-suite/:path*',
        destination: '/dashboard/facebook/:path*',
        permanent: true,
      },
    ];
  },

  // Allow the app to frame itself (same-origin) so the macOS-style desktop can
  // host open apps in chromeless iframes. Only `frame-ancestors` is set here, so
  // this CSP governs *who may frame these pages* and nothing else (it does not
  // restrict scripts/styles). X-Frame-Options is deliberately NOT sent — a
  // `DENY`/`SAMEORIGIN` there would either break the desktop or be redundant.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.sabnode.com",
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Ignore MongoDB optional native deps when bundling
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp:
          /^(@mongodb-js\/zstd|snappy|kerberos|aws4|@aws-sdk\/credential-providers|mongodb-client-encryption)$/,
      })
    );

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // fs, net, tls, crypto removed to enforce clean client bundle
      };
    }

    config.experiments = { ...config.experiments, topLevelAwait: true };

    // Optional: silence "Critical dependency" warnings from dynamic requires
    config.ignoreWarnings = [
      {
        module: /@opentelemetry\/instrumentation/,
      },
      /Critical dependency: the request of a dependency is an expression/,
    ];

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);

