/** @type {import('next').NextConfig} */
const prodHost = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '')
const nextConfig = {
  reactStrictMode: true,
  experimental: {
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
