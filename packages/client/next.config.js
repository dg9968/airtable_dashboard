/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep Better Auth server-side packages out of the browser bundle
  serverExternalPackages: ['pg', 'pg-pool', '@better-auth/kysely-adapter', 'better-auth', 'bcryptjs'],

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

  // /airtable-dashboard was renamed to /business-management (the Airtable
  // backend it was named after was replaced by Postgres in 2026). Kept as a
  // permanent redirect so existing bookmarks still land somewhere.
  async redirects() {
    return [
      {
        source: '/airtable-dashboard',
        destination: '/business-management',
        permanent: true,
      },
    ];
  },

  // No rewrites: /api/* is served by the route handlers under app/api/, which
  // proxy to the Hono server and add the X-API-Key that require-auth expects.
  //
  // There used to be dev-only rewrites for /api/personal/*,
  // /api/services-personal/* and /api/subscriptions-personal/* pointing
  // straight at localhost:3001. Being `afterFiles`, they took precedence over
  // those paths' dynamic [[...path]] route handlers, so in development the
  // browser reached Hono directly with no API key while production went
  // through the proxy — the same URL taking two different code paths, working
  // in dev only because the session cookie satisfies require-auth's other
  // accepted credential. The proxy routes cover every one of those paths in
  // both environments, so the rewrites were redundant as well as divergent.
};

module.exports = nextConfig;