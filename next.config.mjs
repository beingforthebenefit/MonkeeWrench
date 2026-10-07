/** @type {import('next').NextConfig} */
const prodHost = process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, '')
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pdfkit reads its built-in font metrics from its own directory at
    // runtime; bundling it breaks those paths.
    serverComponentsExternalPackages: ['pdfkit'],
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
