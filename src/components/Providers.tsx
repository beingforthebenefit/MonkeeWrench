'use client'

import {ReactNode} from 'react'
import {ThemeProvider, CssBaseline} from '@mui/material'
import {theme} from '@/theme'
import {SessionProvider} from 'next-auth/react'

export default function Providers({
  children,
  session,
}: {
  children: ReactNode
  session: any
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
