/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  // Rewrite old attachment URLs to the new API route
  async rewrites() {
    return [
      {
        source: '/uploads/attachments/:filename',
        destination: '/api/uploads/attachments/:filename',
      },
    ]
  },
}

module.exports = nextConfig
