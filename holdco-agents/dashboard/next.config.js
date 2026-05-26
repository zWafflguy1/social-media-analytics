/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push('better-sqlite3');
    // Allow `.js` import specifiers to resolve to `.ts`/`.tsx` source files.
    // The agents/ and scheduler/ code uses NodeNext-style `.js` imports so it runs
    // under tsx without modification; webpack needs to be told the same mapping.
    config.resolve = config.resolve || {};
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true },
};
