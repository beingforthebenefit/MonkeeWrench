/** @type {import('next').NextConfig} */
const prodHost = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '')
const nextConfig = {
  reactStrictMode: true,
  // scripts/demo.sh builds the public demo beside the dev server's .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  webpack: (config, {dev}) => {
    // In Docker the dev server can't see Tailwind's source-file dependencies
    // through the bind mount, so webpack's on-disk cache served stale CSS
    // (new utility classes missing) even across restarts.
    if (dev) config.cache = false
    return config
  },
  experimental: {
    // How long a page already fetched in this tab is shown again without
    // asking the server (default: 30s for dynamic pages). Every page here is
    // dynamic, the server is a 180ms round trip from the Bay Area, and
    // people stay on a tab longer than 30s, so going back to Songs waited on
    // the network every time. Your own edits still refresh at once
    // (router.refresh clears this), and KeepFresh asks the server on every
    // tab switch whether anyone changed anything, refreshing if so.
    staleTimes: {dynamic: 300, static: 300},
    // pdfkit reads its built-in font metrics from its own directory at
    // runtime; bundling it breaks those paths.
    serverComponentsExternalPackages: [
      'pdfkit',
      'svg-to-pdfkit',
      'jsdom',
      'abcjs',
    ],
    serverActions: {
      // Allow local and the configured production host for server actions
      allowedOrigins: [
        'localhost:3000',
        'localhost:3002',
        ...(prodHost ? [prodHost] : []),
      ],
    },
  },
}
export default nextConfig
