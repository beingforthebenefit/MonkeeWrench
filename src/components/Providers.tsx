'use client'

import {ReactNode} from 'react'
import {SessionProvider} from 'next-auth/react'
import type {Session} from 'next-auth'
import ThemeWatcher from '@/components/ThemeWatcher'
import PwaSetup from '@/components/pwa/PwaSetup'

export default function Providers({
  children,
  session,
}: {
  children: ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <ThemeWatcher />
      <PwaSetup />
      {children}
    </SessionProvider>
  )
}
