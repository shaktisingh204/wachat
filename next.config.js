
/** @type {import('next').NextConfig} */
const webpack = require('webpack');
require('dotenv').config();

const withBundleAnalyzer =
  process.env.ANALYZE === 'true'
    ? require('@next/bundle-analyzer')({ enabled: true })
    : (config) => config;

const nextConfig = {

  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
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
  ],
  turbopack: {},

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

