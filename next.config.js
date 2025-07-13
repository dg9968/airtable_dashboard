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
    domains: [
      'img.youtube.com',
      'i.ytimg.com',
    ],
  },
};

module.exports = nextConfig;