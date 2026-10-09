export const dynamic = 'force-dynamic'

import {prisma} from '@/lib/db'

/**
 * Caddy asks here before getting an HTTPS certificate for a web address it
 * hasn't seen (deploy/Caddyfile, on_demand_tls): yes for a band's own
 * address (Admin → All bands), no for anything else, so nobody can point a
 * random domain at the server and have it collect certificates.
 */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get('domain')?.toLowerCase()
  if (!domain) return new Response('No domain', {status: 400})
  const known =
    domain === process.env.APP_HOST?.toLowerCase() ||
    (await prisma.bandDomain.findUnique({where: {host: domain}})) !== null
  return new Response(null, {status: known ? 200 : 404})
}
