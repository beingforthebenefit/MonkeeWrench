'use client'

import {ReactNode} from 'react'
import {ThemeProvider, CssBaseline} from '@mui/material'
import {theme} from '@/theme'
import {SessionProvider} from 'next-auth/react'
import type {Session} from 'next-auth'

export default function Providers({
  children,
  session,
}: {
  children: ReactNode
  session: Session | null
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </SessionProvider>
  )
}
