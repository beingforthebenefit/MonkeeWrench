import '@/app/globals.css'
import {ReactNode} from 'react'
import type {Metadata, Viewport} from 'next'
import {Archivo, JetBrains_Mono} from 'next/font/google'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import Providers from '@/components/Providers'
import AppShell from '@/components/AppShell'

const archivo = Archivo({subsets: ['latin'], variable: '--font-archivo'})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'Monkee Wrench',
  description: 'Charts, setlists and rehearsals for Monkee Business',
  appleWebApp: {capable: true, title: 'Monkee Wrench', statusBarStyle: 'black'},
}

export const viewport: Viewport = {
  themeColor: '#111315',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({children}: {children: ReactNode}) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrains.variable}`}>
      <body>
        <Providers session={session}>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
