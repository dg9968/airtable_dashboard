/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Fix for cross-origin request error
  allowedDevOrigins: [
    '10.212.1.117', // Your current development IP
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
  ],

  // Image optimization for YouTube thumbnails and other external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Proxy API requests to Hono server (excluding NextAuth routes)
  async rewrites() {
    // In production, don't rewrite - both servers run and client uses NEXT_PUBLIC_API_URL
    // In development, proxy to local Hono server
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    return [
      {
        source: '/api/personal/:path*',
        destination: 'http://localhost:3001/api/personal/:path*',
      },
      {
        source: '/api/services-personal/:path*',
        destination: 'http://localhost:3001/api/services-personal/:path*',
      },
      {
        source: '/api/subscriptions-personal/:path*',
        destination: 'http://localhost:3001/api/subscriptions-personal/:path*',
      },
    ];
  },
};

module.exports = nextConfig;