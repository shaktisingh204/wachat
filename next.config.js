
/** @type {import('next').NextConfig} */
const webpack = require('webpack');
require('dotenv').config();

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  
  output: 'standalone',
  turbopack: {},

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
        fs: false,
        net: false,
        dns: false,
        tls: false,
        'timers/promises': false,
        timers: false,
        child_process: false,
        module: false,
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

    