import '@/app/globals.css'
import {ReactNode} from 'react'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import Providers from '@/components/Providers'
import Nav from '@/components/Nav' // Nav is already a client component

export const metadata = {title: 'Monkee Wrench'}

export default async function RootLayout({children}: {children: ReactNode}) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en">
      <body style={{background: '#0b0b0b'}}>
        <Providers session={session}>
          <Nav />
          <main style={{maxWidth: 900, margin: '0 auto', padding: '16px'}}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
