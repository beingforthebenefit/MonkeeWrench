import '@/app/globals.css'
import {ReactNode} from 'react'
import type {Metadata, Viewport} from 'next'
import {Archivo, JetBrains_Mono} from 'next/font/google'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/db'
import {brandForRequest, currentBand, iconUrl, PRODUCT} from '@/lib/band'
import {chatLabel} from '@/lib/band-fields'
import Providers from '@/components/Providers'
import AppShell, {type ShellBand} from '@/components/AppShell'
import {DEMO} from '@/lib/demo'
import {HOSTED} from '@/lib/hosted'
import {THEME_COLORS, themeScript} from '@/lib/theme'

const archivo = Archivo({subsets: ['latin'], variable: '--font-archivo'})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
})

/** The band this page is shown as: the chosen band, else this address's. */
async function shellContext() {
  const session = await getServerSession(authOptions)
  const user = session?.user?.email
    ? await prisma.user.findUnique({where: {email: session.user.email}})
    : null
  const {band, bands} = user
    ? await currentBand(user.id)
    : {band: null, bands: []}
  const brand = band ? null : await brandForRequest()
  return {session, user, band, bands, brand}
}

export async function generateMetadata(): Promise<Metadata> {
  const {band, brand} = await shellContext()
  const appName = band?.appName ?? brand?.appName ?? PRODUCT
  const icon = band ? iconUrl(band) : (brand?.iconUrl ?? iconUrl(null))
  const forWhom = band?.name ?? brand?.band?.name
  return {
    title: {default: appName, template: `%s · ${appName}`},
    description: forWhom
      ? `Charts, setlists and rehearsals for ${forWhom}`
      : 'Charts, setlists and rehearsals for bands',
    applicationName: appName,
    appleWebApp: {capable: true, title: appName, statusBarStyle: 'black'},
    manifest: '/manifest.webmanifest',
    icons: {icon, apple: icon},
    // The public demo is a copy of one made-up band, not a place to land
    ...(DEMO ? {robots: {index: false, follow: false}} : {}),
  }
}

export const viewport: Viewport = {
  themeColor: THEME_COLORS.dark,
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({children}: {children: ReactNode}) {
  const {session, user, band, bands, brand} = await shellContext()
  const shell: ShellBand = {
    appName: band?.appName ?? brand?.appName ?? PRODUCT,
    band: band
      ? {
          id: band.id,
          name: band.name,
          chat: band.chatUrl
            ? {url: band.chatUrl, label: chatLabel(band.chatUrl)}
            : null,
          isAdmin: band.isAdmin || Boolean(user?.isOwner),
        }
      : null,
    bands: bands.map((b) => ({id: b.id, name: b.name})),
    isOwner: Boolean(user?.isOwner),
    hosted: HOSTED,
  }
  return (
    // data-theme is set by themeScript before React hydrates
    <html
      lang="en"
      className={`${archivo.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
        {/* Before anything can save: see scripts/demo/demo.js */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        {DEMO && <script src="/demo.js" />}
        {/* The public demo is counted like the product page (cookieless);
            the app itself has no analytics */}
        {DEMO && (
          // A module script: deferred by the browser, never blocking
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token": "8b7f3d2b71fe45aa88c2f947f0b24327"}'
          />
        )}
      </head>
      <body>
        <Providers session={session}>
          <AppShell ctx={shell}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
