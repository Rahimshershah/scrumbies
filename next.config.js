/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: Removed 'standalone' output - using npm start instead for reliability

  // Speed up builds by disabling source maps in production
  productionBrowserSourceMaps: false,

  // Optimize for faster builds
  swcMinify: true,

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

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Only in production builds
    if (!dev) {
      // Minimize chunk size
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
          },
        },
      }
    }
    return config
  },
}

module.exports = nextConfig
