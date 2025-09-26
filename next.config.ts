<<<<<<< HEAD

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
=======
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)
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
<<<<<<< HEAD
        hostname: 'wawachat.s3.us-east-1.amazonaws.com',
=======
        hostname: 'images.unsplash.com',
>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
<<<<<<< HEAD
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
        hostname: 'static5.lenskart.com',
=======
        hostname: 'picsum.photos',
>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)
        port: '',
        pathname: '/**',
      },
    ],
  },
<<<<<<< HEAD
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-only modules from the client-side build
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        dns: false,
        tls: false,
        child_process: false,
        "mongodb-client-encryption": false,
      };
    }
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
=======
};

export default nextConfig;
>>>>>>> 253f92ef (Initialized workspace with Firebase Studio)
