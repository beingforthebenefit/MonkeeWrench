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
          {!session?.user && (
            <div className="mx-auto max-w-[900px] px-4">
              <div className="mt-2 mb-2 rounded-md bg-[#222224] text-gray-200 text-sm px-3 py-2">
                Viewing as guest — sign in to propose songs, vote, or manage the
                setlist.
                <a href="/login" className="ml-2 underline text-[#B71C1C]">
                  Sign in
                </a>
              </div>
            </div>
          )}
          <main style={{maxWidth: 900, margin: '0 auto', padding: '16px'}}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
