const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 🔥 IMPORTANT (server-only packages)
  experimental: {
    serverComponentsExternalPackages: [
      'mongodb',
      'snappy',
      'kerberos',
      '@mongodb-js/zstd',
      'aws4',
      '@aws-sdk/credential-providers',
      '@opentelemetry/exporter-jaeger',
    ],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'wawachat.s3.us-east-1.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'scontent.whatsapp.net', pathname: '/**' },
      { protocol: 'https', hostname: 'api.qrserver.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.fbcdn.net', pathname: '/**' },
      { protocol: 'https', hostname: 'static5.lenskart.com', pathname: '/**' },
    ],
  },

  webpack: (config, { isServer }) => {

    // 🔥 prevent client bundle crash
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        dns: false,
        tls: false,
        child_process: false,
        module: false,
        "mongodb-client-encryption": false,
      };
    }

    // 🔥 EXCLUDE native modules completely
    config.externals.push({
      kerberos: 'commonjs kerberos',
      snappy: 'commonjs snappy',
      '@mongodb-js/zstd': 'commonjs @mongodb-js/zstd',
      aws4: 'commonjs aws4',
      '@aws-sdk/credential-providers': 'commonjs @aws-sdk/credential-providers',
      '@opentelemetry/exporter-jaeger': 'commonjs @opentelemetry/exporter-jaeger',
    });

    config.experiments = { ...config.experiments, topLevelAwait: true };

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
